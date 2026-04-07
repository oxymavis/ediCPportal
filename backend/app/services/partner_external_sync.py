from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
import re
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models import Certificate, Notification, Partner, PartnerSyncLog, Subsidiary
from app.services.certificate_content import build_external_certificate_chain

EXTERNAL_ID_TYPES = ('95', '147')
SYNC_CREATE = 'create'
SYNC_UPDATE = 'update'
SYNC_DELETE = 'delete'
SYNC_NOT_SYNCED = 'not_synced'
SYNC_SYNCED = 'synced'
SYNC_FAILED = 'failed'
SYNC_CERTIFICATE_PENDING = 'certificate_pending'
CERT_NOT_REQUIRED = 'not_required'
CERT_PENDING = 'pending'
CERT_SYNCED = 'synced'
CERT_FAILED = 'failed'


@dataclass
class SyncResult:
    ok: bool
    request_id: str
    payload: dict[str, Any]
    response_payload: dict[str, Any] | None
    http_status: int | None
    error: str | None
    action: str
    environment: str | None = None
    external_partner_id: str | None = None
    warning: str | None = None


def _certificate_is_applicable(partner: Partner, action: str) -> bool:
    return action != SYNC_DELETE and (partner.communication_channel or '').upper() == 'AS2'


def _compute_overall_status(partner_status: str, certificate_status: str) -> str:
    if partner_status == SYNC_FAILED or certificate_status == CERT_FAILED:
        return SYNC_FAILED
    if partner_status != SYNC_SYNCED:
        return SYNC_NOT_SYNCED
    if certificate_status == CERT_PENDING:
        return SYNC_CERTIFICATE_PENDING
    return SYNC_SYNCED


def _safe_port(parsed, default_protocol: str) -> str:
    if parsed.port:
        return str(parsed.port)
    if default_protocol == 'https':
        return '443'
    if default_protocol == 'http':
        return '80'
    if default_protocol == 'sftp':
        return '22'
    return ''


def _parse_endpoint(url: str | None, fallback_protocol: str, port_override: str | None = None) -> dict[str, str]:
    raw = (url or '').strip()
    if not raw:
        return {
            'protocol': fallback_protocol,
            'targetHost': '',
            'targetPort': (port_override or '').strip(),
            'urlPath': '',
        }
    parsed = urlparse(raw if '://' in raw else f'{fallback_protocol}://{raw}')
    return {
        'protocol': (parsed.scheme or fallback_protocol or 'http').lower(),
        'targetHost': parsed.hostname or '',
        'targetPort': (port_override or '').strip() or _safe_port(parsed, fallback_protocol or parsed.scheme or 'http'),
        'urlPath': parsed.path or ('/' if parsed.hostname else ''),
    }


def _validate_as2_sync_profile(profile: Any | None) -> str | None:
    if not profile:
        return 'AS2 profile is required before external sync'
    as2_id = str(getattr(profile, 'as2_id', '') or '').strip()
    as2_url = str(getattr(profile, 'as2_url', '') or '').strip()
    if not as2_id:
        return 'AS2 identifier is required before external sync'
    if not as2_url:
        return 'AS2 endpoint URL is required before external sync'
    parsed = urlparse(as2_url)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
        return 'AS2 endpoint URL must be a valid http(s) URL before external sync'
    return None


def _build_external_ids(partner: Partner, action: str) -> dict[str, Any]:
    if action == SYNC_DELETE:
        return {
            'operation': 'N',
            'data': [],
        }
    value = (partner.code or partner.name or '').strip()
    op = {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N')
    return {
        'operation': op,
        'data': [{'idType': id_type, 'value': value} for id_type in EXTERNAL_ID_TYPES] if value else [],
    }


def _find_partner_certificate(db: Session, partner: Partner, cert_name: str | None, environment: str | None = None) -> Certificate | None:
    q = db.query(Certificate).filter(Certificate.partner == partner.name)
    normalized_environment = (environment or '').strip().lower()
    if normalized_environment:
        q = q.filter(Certificate.environment == normalized_environment)
    if cert_name:
        exact = q.filter(Certificate.name == cert_name).order_by(Certificate.created_at.desc()).first()
        if exact:
            return exact
    by_content = q.filter(Certificate.raw_content.is_not(None), Certificate.status == 'active').order_by(Certificate.created_at.desc()).first()
    if by_content:
        return by_content
    return q.order_by(Certificate.created_at.desc()).first()


def _build_certificate_payload(db: Session, partner: Partner, profile: Any | None, action: str, environment: str | None = None) -> tuple[dict[str, Any], str | None]:
    if action == SYNC_DELETE:
        return {'operation': 'N', 'data': {}}, None
    if not profile:
        return {'operation': 'N', 'data': {}}, 'No AS2 profile found for certificate sync'
    cert_name = profile.signing_cert or profile.encryption_cert
    cert = _find_partner_certificate(db, partner, cert_name, environment=environment)
    if not cert or not cert.raw_content:
        return {'operation': 'N', 'data': {}}, 'Partner synced, certificate not included'
    return (
        {
            'operation': 'C' if action == SYNC_CREATE else 'U',
            'data': {
                'certificateName': cert.name,
                'serialNumber': cert.serial_number,
                'thumbprint': cert.fingerprint,
                'rawContent': build_external_certificate_chain(cert.raw_content),
            },
        },
        None,
    )


def _build_channel_sections(db: Session, partner: Partner, action: str, environment: str | None = None) -> tuple[dict[str, Any], str | None]:
    channel = (partner.communication_channel or '').upper()
    channel_cfg = partner.channel_config or {}
    primary_sub = partner.subsidiaries[0] if partner.subsidiaries else None
    primary_profile = primary_sub.as2_profiles[0] if primary_sub and primary_sub.as2_profiles else None
    warning: str | None = None
    if action == SYNC_DELETE:
        return (
            {
                'deliverySetting': {'operation': 'N', 'data': {}},
                'ediint': {'operation': 'N', 'data': {}},
                'certificate': {'operation': 'N', 'data': {}},
            },
            None,
        )

    if channel == 'AS2':
        profile_error = _validate_as2_sync_profile(primary_profile)
        if profile_error:
            return (
                {
                    'deliverySetting': {'operation': 'N', 'data': {'protocol': '', 'targetHost': '', 'targetPort': '', 'urlPath': ''}},
                    'ediint': {'operation': 'N', 'data': {}},
                    'certificate': {'operation': 'N', 'data': {}},
                },
                profile_error,
            )
        endpoint = _parse_endpoint(
            primary_profile.as2_url if primary_profile else '',
            'https',
            port_override=str(primary_profile.as2_port) if primary_profile and primary_profile.as2_port else None,
        )
        certificate, cert_warning = _build_certificate_payload(db, partner, primary_profile, action, environment=environment)
        warning = cert_warning
        return (
            {
                'deliverySetting': {
                    'operation': {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N'),
                    'data': endpoint,
                },
                'ediint': {
                    'operation': {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N'),
                    'data': {
                        'as2Id': primary_profile.as2_id if primary_profile else '',
                        'as2Url': primary_profile.as2_url if primary_profile else '',
                        'senderId': primary_profile.sender_id if primary_profile else '',
                        'senderQualifier': primary_profile.sender_qualifier if primary_profile else '',
                        'receiverId': primary_profile.receiver_id if primary_profile else '',
                        'receiverQualifier': primary_profile.receiver_qualifier if primary_profile else '',
                        'mdnMode': 'SYNC',
                        'signingRequired': bool(primary_profile and (primary_profile.signing_cert or primary_profile.mdn_signed)),
                        'encryptionRequired': bool(primary_profile and (primary_profile.encryption_cert or primary_profile.mdn_required)),
                    } if action != SYNC_DELETE else {},
                },
                'certificate': certificate,
            },
            warning,
        )

    if channel == 'REST_API':
        endpoint = _parse_endpoint((partner.api_config or {}).get('baseUrl'), 'https')
        return (
            {
                'deliverySetting': {
                    'operation': {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N'),
                    'data': endpoint,
                },
                'ediint': {'operation': 'N', 'data': {}},
                'certificate': {'operation': 'N', 'data': {}},
            },
            None,
        )

    if channel == 'SFTP':
        endpoint = {
            'protocol': 'sftp',
            'targetHost': str(channel_cfg.get('host') or ''),
            'targetPort': str(channel_cfg.get('port') or '22'),
            'urlPath': str(channel_cfg.get('remotePath') or ''),
        }
        return (
            {
                'deliverySetting': {
                    'operation': {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N'),
                    'data': endpoint,
                },
                'ediint': {'operation': 'N', 'data': {}},
                'certificate': {'operation': 'N', 'data': {}},
            },
            None,
        )

    if channel == 'VAN':
        endpoint = {
            'protocol': 'van',
            'targetHost': str(channel_cfg.get('targetHost') or ''),
            'targetPort': str(channel_cfg.get('targetPort') or ''),
            'urlPath': str(channel_cfg.get('urlPath') or ''),
        }
        return (
            {
                'deliverySetting': {
                    'operation': {'create': 'C', 'update': 'U', 'delete': 'D'}.get(action, 'N'),
                    'data': endpoint,
                },
                'ediint': {'operation': 'N', 'data': {}},
                'certificate': {'operation': 'N', 'data': {}},
            },
            None,
        )

    return (
        {
            'deliverySetting': {'operation': 'N', 'data': {'protocol': '', 'targetHost': '', 'targetPort': '', 'urlPath': ''}},
            'ediint': {'operation': 'N', 'data': {}},
            'certificate': {'operation': 'N', 'data': {}},
        },
        f'Unsupported communication channel: {channel or "unknown"}',
    )


def build_partner_sync_payload(db: Session, partner: Partner, action: str, request_id: str | None = None, environment: str | None = None) -> tuple[dict[str, Any], str | None]:
    sections, warning = _build_channel_sections(db, partner, action, environment=environment)
    payload = {
        'requestId': request_id or uuid4().hex,
        'partnerId': '' if action == SYNC_CREATE else (partner.external_partner_id or ''),
        'partnerName': partner.name,
        'lifecycle': 'DELETE' if action == SYNC_DELETE else 'NONE',
        'profile': {
            'externalIds': _build_external_ids(partner, action),
            **sections,
        },
    }
    return payload, warning


def _create_sync_notification(db: Session, partner: Partner, result: SyncResult) -> None:
    message = result.error or result.warning or 'Unknown sync error'
    db.add(
        Notification(
            type='warning',
            title=f'Partner sync failed: {partner.name}',
            message=message,
            date=datetime.utcnow().strftime('%Y-%m-%d'),
            time=datetime.utcnow().strftime('%H:%M:%S'),
            read=False,
            archived=False,
            environment=result.environment or partner.environment or 'default',
            action={'label': 'Retry Sync', 'link': f'/dashboard?tab=partners&partnerId={partner.id}'},
            details={'partnerId': partner.id, 'requestId': result.request_id, 'syncAction': result.action},
        )
    )


def _decode_external_response(response: httpx.Response) -> tuple[dict[str, Any] | None, str | None]:
    if not response.content:
        return None, None
    text = response.text.strip()
    if not text:
        return None, None
    try:
        parsed = response.json()
        if isinstance(parsed, dict):
            if 'message' not in parsed:
                msg = parsed.get('msgStr') or parsed.get('errorMessage')
                if isinstance(msg, str) and msg.strip():
                    parsed['message'] = msg.strip()
            if 'partnerId' not in parsed:
                nested_partner_id: Any | None = None
                output = parsed.get('output')
                if isinstance(output, dict):
                    nested_partner_id = output.get('partnerId')
                    if not nested_partner_id:
                        delivery_info = output.get('deliveryInfo')
                        if isinstance(delivery_info, list) and delivery_info and isinstance(delivery_info[0], dict):
                            nested_partner_id = delivery_info[0].get('PartnerID')
                if isinstance(nested_partner_id, str) and nested_partner_id.strip():
                    parsed['partnerId'] = nested_partner_id.strip()
            if 'success' not in parsed:
                status_hint = str(parsed.get('newUserStatus') or '').strip().upper()
                if status_hint:
                    parsed['success'] = status_hint in {'OK', 'SUCCESS'}
            return parsed, None
        return {'raw': parsed}, None
    except ValueError:
        payload: dict[str, Any] = {'raw': text}
        success_match = re.search(r'["\']?success["\']?\s*[:=]\s*["\']?(true|false)["\']?', text, re.IGNORECASE)
        message_match = re.search(r'["\']?message["\']?\s*[:=]\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
        partner_id_match = re.search(r'["\']?partnerId["\']?\s*[:=]\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
        if success_match:
            payload['success'] = success_match.group(1).lower() == 'true'
        if message_match:
            payload['message'] = message_match.group(1)
        if partner_id_match:
            payload['partnerId'] = partner_id_match.group(1)
        if len(payload) > 1:
            return payload, 'External sync returned non-standard JSON'
        return payload, 'External sync returned unreadable response'


def _next_attempt_no(db: Session, partner_id: str, action: str) -> int:
    row = (
        db.query(PartnerSyncLog)
        .filter(PartnerSyncLog.partner_id == partner_id, PartnerSyncLog.action == action)
        .order_by(PartnerSyncLog.attempt_no.desc(), PartnerSyncLog.id.desc())
        .first()
    )
    return (row.attempt_no if row else 0) + 1


def record_sync_result(db: Session, partner: Partner, result: SyncResult) -> None:
    cert_applicable = _certificate_is_applicable(partner, result.action)
    partner.external_last_attempt_at = datetime.utcnow()
    next_action = result.action
    if result.action == SYNC_CREATE and result.external_partner_id:
        next_action = SYNC_UPDATE
    partner.external_pending_action = None if result.ok else next_action
    partner.external_partner_sync_status = SYNC_SYNCED if result.ok else SYNC_FAILED
    partner.external_last_error = result.error
    if result.external_partner_id:
        partner.external_partner_id = result.external_partner_id
    if result.ok:
        partner.external_last_synced_at = datetime.utcnow()
        if cert_applicable:
            partner.external_certificate_sync_status = CERT_PENDING if result.warning else CERT_SYNCED
            partner.external_last_warning = result.warning
        else:
            partner.external_certificate_sync_status = CERT_NOT_REQUIRED
            partner.external_last_warning = None
    else:
        if cert_applicable and partner.external_certificate_sync_status not in {CERT_PENDING, CERT_SYNCED}:
            partner.external_certificate_sync_status = CERT_PENDING
        partner.external_last_warning = result.warning if result.warning and not result.error else partner.external_last_warning
    partner.external_sync_status = _compute_overall_status(
        partner.external_partner_sync_status,
        partner.external_certificate_sync_status,
    )
    db.add(
        PartnerSyncLog(
            partner_id=partner.id,
            action=result.action,
            request_id=result.request_id,
            request_payload=result.payload,
            response_payload=result.response_payload,
            http_status=result.http_status,
            result='success' if result.ok else 'failed',
            error_message=result.error or result.warning,
            attempt_no=_next_attempt_no(db, partner.id, result.action),
        )
    )
    if not result.ok:
        _create_sync_notification(db, partner, result)


def sync_partner_to_external(db: Session, partner: Partner, action: str, environment: str | None = None) -> SyncResult:
    request_id = uuid4().hex
    sync_environment = 'default'
    payload, warning = build_partner_sync_payload(db, partner, action, request_id=request_id, environment=sync_environment)
    target = settings.partner_sync_target(sync_environment)
    target_env = str(target['environment'])
    target_url = str(target['url'] or '')
    target_username = str(target['username'] or '')
    target_password = str(target['password'] or '')
    if action != SYNC_DELETE and (partner.communication_channel or '').upper() == 'AS2':
        primary_sub = partner.subsidiaries[0] if partner.subsidiaries else None
        primary_profile = primary_sub.as2_profiles[0] if primary_sub and primary_sub.as2_profiles else None
        profile_error = _validate_as2_sync_profile(primary_profile)
        if profile_error:
            return SyncResult(
                ok=False,
                request_id=request_id,
                payload=payload,
                response_payload=None,
                http_status=None,
                error=profile_error,
                action=action,
                environment=sync_environment,
                warning=warning,
            )
    if not settings.partner_sync_enabled:
        return SyncResult(
            ok=False,
            request_id=request_id,
            payload=payload,
            response_payload=None,
            http_status=None,
            error='Partner sync is disabled',
            action=action,
            environment=sync_environment,
            warning=warning,
        )
    if not target_url or not target_username or not target_password:
        return SyncResult(
            ok=False,
            request_id=request_id,
            payload=payload,
            response_payload=None,
            http_status=None,
            error='Partner sync configuration is incomplete',
            action=action,
            environment=sync_environment,
            warning=warning,
        )

    try:
        with httpx.Client(
            timeout=float(target['timeout_seconds']),
            verify=bool(target['verify_tls']),
            auth=(target_username, target_password),
        ) as client:
            response = client.post(target_url, json=payload)
        response_payload, parse_warning = _decode_external_response(response)
    except httpx.TimeoutException:
        return SyncResult(
            ok=False,
            request_id=request_id,
            payload=payload,
            response_payload=None,
            http_status=None,
            error='Partner sync timed out',
            action=action,
            environment=sync_environment,
            warning=warning,
        )
    except Exception as exc:
        return SyncResult(
            ok=False,
            request_id=request_id,
            payload=payload,
            response_payload=None,
            http_status=None,
            error=f'Partner sync failed: {exc}',
            action=action,
            environment=sync_environment,
            warning=warning,
        )

    success = bool(isinstance(response_payload, dict) and response_payload.get('success') is True)
    error = None if success else (
        (response_payload or {}).get('message')
        if isinstance(response_payload, dict)
        else f'External sync failed with HTTP {response.status_code}'
    )
    if not success and parse_warning and not error:
        error = parse_warning
    external_partner_id = None
    if isinstance(response_payload, dict):
        external_partner_id = response_payload.get('partnerId')
    return SyncResult(
        ok=success,
        request_id=request_id,
        payload=payload,
        response_payload=response_payload if isinstance(response_payload, dict) else {'raw': str(response_payload)},
        http_status=response.status_code,
        error=error,
        action=action,
        environment=sync_environment,
        external_partner_id=external_partner_id,
        warning=warning or (parse_warning if success else None),
    )


def load_partner_with_relations(db: Session, partner_id: str) -> Partner | None:
    return (
        db.query(Partner)
        .options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
        .filter(Partner.id == partner_id)
        .first()
    )
