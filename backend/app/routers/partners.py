from __future__ import annotations
from datetime import datetime
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import AS2Profile, Certificate, Partner, Subsidiary
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import partner_to_api
from app.services.partner_external_sync import (
    CERT_PENDING,
    SYNC_CREATE,
    SYNC_CERTIFICATE_PENDING,
    SYNC_DELETE,
    SYNC_FAILED,
    SYNC_NOT_SYNCED,
    SYNC_SYNCED,
    SYNC_UPDATE,
    load_partner_with_relations,
    record_sync_result,
    sync_partner_to_external,
)
from app.services.validation import validate_message_routing

router = APIRouter(prefix='/v1/partners', tags=['partners'], dependencies=[Depends(get_actor), Depends(require_scope('partners'))])

ALLOWED_INTEGRATION_TYPES = {'edi', 'api'}
ALLOWED_CHANNELS = {'AS2', 'SFTP', 'VAN', 'REST_API', 'WEBHOOK'}
ALLOWED_AS2_QUALIFIERS = {f'{x:02d}' for x in range(1, 34)} | {'ZZ'}
ALLOWED_PARTNER_TYPES = {'platform', 'retailer', 'van', '3pl', 'manufacturer'}
ALLOWED_SERVICE_TIERS = {'enterprise', 'standard', 'basic'}
MAX_LIFECYCLE_STEP = 4


def _validate_api_config(payload: dict | None) -> tuple[bool, str | None]:
    if not payload:
        return True, None
    base_url = payload.get('baseUrl')
    auth_method = payload.get('authMethod')
    if base_url and not str(base_url).startswith(('http://', 'https://')):
        return False, 'apiConfig.baseUrl must start with http:// or https://'
    if auth_method and auth_method not in {'Bearer Token', 'API Key', 'OAuth 2.0'}:
        return False, 'apiConfig.authMethod must be one of Bearer Token/API Key/OAuth 2.0'
    return True, None


def _validate_as2_profile(profile: dict) -> tuple[bool, str | None]:
    as2_id = str(profile.get('as2Id') or '').strip()
    as2_url = str(profile.get('as2Url') or '').strip()
    port = profile.get('as2Port')
    sender_id = str(profile.get('senderId') or '').strip()
    receiver_id = str(profile.get('receiverId') or '').strip()
    sender_qualifier = str(profile.get('senderQualifier') or '').strip().upper()
    receiver_qualifier = str(profile.get('receiverQualifier') or '').strip().upper()

    if not as2_id:
        return False, 'AS2 identifier is required'
    if not as2_url:
        return False, 'AS2 endpoint URL is required'
    parsed_url = urlparse(as2_url)
    if parsed_url.scheme not in {'http', 'https'} or not parsed_url.hostname:
        return False, 'AS2 endpoint URL must be a valid http(s) URL'
    if port in (None, ''):
        return False, 'AS2 port is required'
    try:
        parsed_port = int(port)
    except (TypeError, ValueError):
        return False, 'AS2 port must be an integer'
    if parsed_port <= 0 or parsed_port > 65535:
        return False, 'AS2 port must be between 1 and 65535'
    if not sender_id:
        return False, 'AS2 senderId is required'
    if not receiver_id:
        return False, 'AS2 receiverId is required'
    if sender_qualifier not in ALLOWED_AS2_QUALIFIERS:
        return False, 'AS2 senderQualifier must be one of 01-33 or ZZ'
    if receiver_qualifier not in ALLOWED_AS2_QUALIFIERS:
        return False, 'AS2 receiverQualifier must be one of 01-33 or ZZ'
    return True, None


def _serialize_as2_profile(profile: AS2Profile) -> dict:
    return {
        'id': profile.id,
        'name': profile.name,
        'as2Id': profile.as2_id,
        'as2Url': profile.as2_url,
        'as2Port': profile.as2_port,
        'senderId': profile.sender_id,
        'senderQualifier': profile.sender_qualifier,
        'receiverId': profile.receiver_id,
        'receiverQualifier': profile.receiver_qualifier,
        'status': profile.status,
        'encryptionCert': profile.encryption_cert,
        'signingCert': profile.signing_cert,
        'mdnRequired': profile.mdn_required,
        'mdnSigned': profile.mdn_signed,
        'encryptionAlgorithm': profile.encryption_algorithm,
        'signatureAlgorithm': profile.signature_algorithm,
    }


def _validate_partner_profile(payload: dict) -> tuple[bool, str | None]:
    partner_type = str(payload.get('type') or 'retailer').strip().lower()
    service_tier = str(payload.get('tier') or 'standard').strip().lower()
    code = str(payload.get('code') or '').strip().upper()
    if partner_type not in ALLOWED_PARTNER_TYPES:
        return False, 'type must be one of platform/retailer/van/3pl/manufacturer'
    if service_tier not in ALLOWED_SERVICE_TIERS:
        return False, 'tier must be one of enterprise/standard/basic'
    if code and len(code) > 20:
        return False, 'code must be 20 characters or fewer'
    return True, None


def _normalize_channel_config(payload: dict, integration_type: str, communication_channel: str, existing: dict | None = None) -> dict:
    cfg = dict(existing or {})
    direct_cfg = payload.get('channelConfig')
    if isinstance(direct_cfg, dict):
        cfg.update(direct_cfg)
    if integration_type == 'api':
        api_cfg = payload.get('apiConfig') if isinstance(payload.get('apiConfig'), dict) else {}
        if api_cfg.get('baseUrl') is not None:
            cfg['baseUrl'] = api_cfg.get('baseUrl') or ''
        if api_cfg.get('webhook') is not None:
            cfg['webhookUrl'] = api_cfg.get('webhook') or ''
        return cfg
    if communication_channel == 'SFTP':
        if payload.get('sftpHost') is not None:
            cfg['host'] = payload.get('sftpHost') or ''
        if payload.get('sftpPort') is not None:
            cfg['port'] = str(payload.get('sftpPort') or '22')
        elif 'port' not in cfg:
            cfg['port'] = '22'
        if payload.get('sftpUser') is not None:
            cfg['username'] = payload.get('sftpUser') or ''
        if payload.get('sftpRemotePath') is not None:
            cfg['remotePath'] = payload.get('sftpRemotePath') or ''
        return cfg
    if communication_channel == 'VAN':
        if payload.get('vanProvider') is not None:
            cfg['provider'] = payload.get('vanProvider') or ''
        if payload.get('vanNetworkId') is not None:
            cfg['networkId'] = payload.get('vanNetworkId') or ''
        if payload.get('vanTargetHost') is not None:
            cfg['targetHost'] = payload.get('vanTargetHost') or ''
        if payload.get('vanTargetPort') is not None:
            cfg['targetPort'] = str(payload.get('vanTargetPort') or '')
        if payload.get('vanUrlPath') is not None:
            cfg['urlPath'] = payload.get('vanUrlPath') or ''
        return cfg
    return cfg


def _sync_action_for_partner(partner: Partner, requested_action: str) -> str:
    if requested_action == SYNC_DELETE:
        return SYNC_DELETE
    if partner.external_partner_id:
        return SYNC_UPDATE
    return SYNC_CREATE


def _has_syncable_certificate(db: Session, partner: Partner) -> bool:
    return (
        db.query(Certificate.id)
        .filter(Certificate.partner == partner.name)
        .filter(Certificate.raw_content.is_not(None))
        .first()
        is not None
    )


def _mark_certificate_pending(partner: Partner) -> None:
    partner.external_sync_status = SYNC_CERTIFICATE_PENDING
    partner.external_partner_sync_status = SYNC_NOT_SYNCED
    partner.external_certificate_sync_status = CERT_PENDING
    partner.external_pending_action = None
    partner.external_last_error = None
    partner.external_last_warning = 'Upload a certificate to start external sync'


@router.get('')
def get_partners(environment: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Partner).options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
    if environment:
        q = q.filter((Partner.environment == environment) | (Partner.environment.is_(None)))
    return ok([partner_to_api(p) for p in q.all()])


@router.get('/{partner_id}')
def get_partner(partner_id: str, db: Session = Depends(get_db)):
    p = (
        db.query(Partner)
        .options(joinedload(Partner.subsidiaries).joinedload(Subsidiary.as2_profiles))
        .filter(Partner.id == partner_id)
        .first()
    )
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    return ok(partner_to_api(p))


@router.post('')
def create_partner(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    name = (payload.get('name') or '').strip()
    code = (payload.get('code') or '').strip().upper()
    if not name or not code:
        return fail('Missing required fields: name, code', 'PARTNER_VALIDATION')

    primary = payload.get('primaryContact') or {}
    if not (primary.get('email') or payload.get('email')):
        return fail('Primary contact email is required', 'PARTNER_VALIDATION')
    valid_partner, partner_err = _validate_partner_profile(payload)
    if not valid_partner:
        return fail(partner_err or 'Invalid partner profile', 'PARTNER_VALIDATION')

    integration_type = (payload.get('integrationType') or 'edi').lower()
    if integration_type not in ALLOWED_INTEGRATION_TYPES:
        return fail('integrationType must be edi or api', 'PARTNER_VALIDATION')
    communication_channel = payload.get('communicationChannel') or ('AS2' if integration_type == 'edi' else 'REST_API')
    if communication_channel not in ALLOWED_CHANNELS:
        return fail('Invalid communicationChannel', 'PARTNER_VALIDATION')
    valid_cfg, cfg_err = _validate_api_config(payload.get('apiConfig'))
    if not valid_cfg:
        return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_VALIDATION')
    for s in payload.get('subsidiaries', []):
        for a in s.get('as2Profiles', []):
            valid_as2, as2_err = _validate_as2_profile(a)
            if not valid_as2:
                return fail(as2_err or 'Invalid AS2 profile', 'PARTNER_VALIDATION')

    current_step_id = int(payload.get('currentStepId') or 1)
    current_step_id = max(1, min(MAX_LIFECYCLE_STEP, current_step_id))
    onboarding_start_date = payload.get('onboardingStartDate') or datetime.utcnow().strftime('%Y-%m-%d')
    step_completion_dates = payload.get('stepCompletionDates') or {}

    partner = Partner(
        id=str(uuid4()),
        name=name,
        code=code,
        partner_type=str(payload.get('type') or 'retailer').strip().lower(),
        service_tier=str(payload.get('tier') or 'standard').strip().lower(),
        status=payload.get('status', 'active'),
        industry=payload.get('industry', 'retail'),
        website=payload.get('website'),
        contact_name=primary.get('name') or payload.get('contactName') or '',
        contact_email=primary.get('email') or payload.get('email') or '',
        contact_phone=primary.get('phone') or payload.get('contactPhone'),
        integration_type=integration_type,
        communication_channel=communication_channel,
        current_step_id=current_step_id,
        onboarding_start_date=onboarding_start_date,
        step_completion_dates=step_completion_dates,
        api_config=payload.get('apiConfig'),
        channel_config=_normalize_channel_config(payload, integration_type, communication_channel),
        external_sync_status=SYNC_NOT_SYNCED,
        environment=payload.get('environment', 'default'),
    )

    for s in payload.get('subsidiaries', []):
        sub = Subsidiary(
            id=str(uuid4()),
            name=s.get('name', ''),
            code=s.get('code', ''),
            region=s.get('region', ''),
            status=s.get('status', 'active'),
            supported_doc_types_x12=((s.get('supportedDocTypes') or {}).get('x12') or []),
            supported_doc_types_edifact=((s.get('supportedDocTypes') or {}).get('edifact') or []),
            message_routing=validate_message_routing(s.get('messageRouting')),
        )
        for a in s.get('as2Profiles', []):
            sub.as2_profiles.append(
                AS2Profile(
                    id=str(uuid4()),
                    name=a.get('name', ''),
                    as2_id=a.get('as2Id', ''),
                    as2_url=a.get('as2Url', ''),
                    as2_port=int(a.get('as2Port') or 443),
                    sender_id=a.get('senderId', ''),
                    sender_qualifier=(a.get('senderQualifier') or 'ZZ').upper(),
                    receiver_id=a.get('receiverId', ''),
                    receiver_qualifier=(a.get('receiverQualifier') or 'ZZ').upper(),
                    status=a.get('status', 'active'),
                    encryption_cert=a.get('encryptionCert'),
                    signing_cert=a.get('signingCert'),
                    mdn_required=a.get('mdnRequired', True),
                    mdn_signed=a.get('mdnSigned', True),
                    encryption_algorithm=a.get('encryptionAlgorithm', 'AES-256'),
                    signature_algorithm=a.get('signatureAlgorithm', 'SHA-256'),
                )
            )
        partner.subsidiaries.append(sub)

    db.add(partner)
    db.commit()
    partner = load_partner_with_relations(db, partner.id)
    if partner is None:
        return fail('Partner not found after create', 'PARTNER_NOT_FOUND')
    if (partner.communication_channel or '').upper() == 'AS2' and not _has_syncable_certificate(db, partner):
        _mark_certificate_pending(partner)
    else:
        result = sync_partner_to_external(db, partner, SYNC_CREATE)
        record_sync_result(db, partner, result)
    db.commit()
    db.refresh(partner)
    return ok(partner_to_api(partner))


@router.put('/{partner_id}')
def update_partner(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    valid_partner, partner_err = _validate_partner_profile({
        'type': payload.get('type', p.partner_type),
        'tier': payload.get('tier', p.service_tier),
        'code': payload.get('code', p.code),
    })
    if not valid_partner:
        return fail(partner_err or 'Invalid partner profile', 'PARTNER_VALIDATION')

    for field, attr in [
        ('name', 'name'),
        ('code', 'code'),
        ('type', 'partner_type'),
        ('tier', 'service_tier'),
        ('status', 'status'),
        ('industry', 'industry'),
        ('website', 'website'),
        ('environment', 'environment'),
        ('integrationType', 'integration_type'),
        ('communicationChannel', 'communication_channel'),
        ('currentStepId', 'current_step_id'),
        ('onboardingStartDate', 'onboarding_start_date'),
        ('stepCompletionDates', 'step_completion_dates'),
        ('apiConfig', 'api_config'),
    ]:
        if payload.get(field) is not None:
            if field == 'code':
                setattr(p, attr, str(payload.get(field) or '').strip().upper())
                continue
            if field in {'type', 'tier'}:
                setattr(p, attr, str(payload.get(field) or '').strip().lower())
                continue
            if field == 'integrationType' and payload.get(field) not in ALLOWED_INTEGRATION_TYPES:
                return fail('integrationType must be edi or api', 'PARTNER_VALIDATION')
            if field == 'communicationChannel' and payload.get(field) not in ALLOWED_CHANNELS:
                return fail('Invalid communicationChannel', 'PARTNER_VALIDATION')
            if field == 'apiConfig':
                valid_cfg, cfg_err = _validate_api_config(payload.get('apiConfig'))
                if not valid_cfg:
                    return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_VALIDATION')
            setattr(p, attr, payload.get(field))

    if payload.get('primaryContact'):
        contact = payload['primaryContact']
        p.contact_name = contact.get('name', p.contact_name)
        p.contact_email = contact.get('email', p.contact_email)
        p.contact_phone = contact.get('phone', p.contact_phone)

    communication_channel = p.communication_channel or ('REST_API' if (p.integration_type or 'edi') == 'api' else 'AS2')
    p.channel_config = _normalize_channel_config(payload, p.integration_type or 'edi', communication_channel, p.channel_config)

    db.commit()
    p = load_partner_with_relations(db, partner_id)
    if p is None:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    sync_action = _sync_action_for_partner(p, SYNC_UPDATE)
    if (p.communication_channel or '').upper() == 'AS2' and not p.external_partner_id and not _has_syncable_certificate(db, p):
        _mark_certificate_pending(p)
    else:
        result = sync_partner_to_external(db, p, sync_action)
        record_sync_result(db, p, result)
    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.put('/{partner_id}/lifecycle')
def update_partner_lifecycle(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')

    if payload.get('currentStepId') is not None:
        p.current_step_id = max(1, min(MAX_LIFECYCLE_STEP, int(payload.get('currentStepId'))))
    if payload.get('onboardingStartDate') is not None:
        p.onboarding_start_date = payload.get('onboardingStartDate')
    if payload.get('stepCompletionDates') is not None:
        p.step_completion_dates = payload.get('stepCompletionDates') or {}

    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.post('/{partner_id}/lifecycle/advance')
def advance_partner_lifecycle(
    partner_id: str,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    current = p.current_step_id or 1
    if current < MAX_LIFECYCLE_STEP:
        p.current_step_id = current + 1
    dates = p.step_completion_dates or {}
    dates[str(p.current_step_id)] = datetime.utcnow().strftime('%Y-%m-%d')
    p.step_completion_dates = dates
    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))


@router.post('/{partner_id}/api-config/validate')
def validate_partner_api_config(
    partner_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = db.query(Partner).filter(Partner.id == partner_id).first()
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    valid_cfg, cfg_err = _validate_api_config(payload)
    if not valid_cfg:
        return fail(cfg_err or 'Invalid apiConfig', 'PARTNER_API_CONFIG_INVALID')
    masked = dict(payload)
    if masked.get('apiKey'):
        masked['apiKey'] = '***MASKED***'
    return ok({'valid': True, 'maskedConfig': masked})


@router.get('/{partner_id}/subsidiaries/{subsidiary_id}/routing')
def get_subsidiary_routing(partner_id: str, subsidiary_id: str, db: Session = Depends(get_db)):
    sub = (
        db.query(Subsidiary)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id)
        .first()
    )
    if not sub:
        return fail('Subsidiary not found', 'SUBSIDIARY_NOT_FOUND')
    return ok(sub.message_routing or {'enabledTypes': [], 'rules': []})


@router.put('/{partner_id}/subsidiaries/{subsidiary_id}/routing')
def update_subsidiary_routing(
    partner_id: str,
    subsidiary_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    sub = (
        db.query(Subsidiary)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id)
        .first()
    )
    if not sub:
        return fail('Subsidiary not found', 'SUBSIDIARY_NOT_FOUND')

    sub.message_routing = validate_message_routing(payload)
    db.commit()
    db.refresh(sub)
    return ok(sub.message_routing)


@router.put('/{partner_id}/subsidiaries/{subsidiary_id}/as2-profiles/{profile_id}')
def update_as2_profile(
    partner_id: str,
    subsidiary_id: str,
    profile_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    profile = (
        db.query(AS2Profile)
        .join(Subsidiary, Subsidiary.id == AS2Profile.subsidiary_id)
        .join(Partner, Partner.id == Subsidiary.partner_id)
        .filter(Partner.id == partner_id, Subsidiary.id == subsidiary_id, AS2Profile.id == profile_id)
        .first()
    )
    if not profile:
        return fail('AS2 profile not found', 'AS2_PROFILE_NOT_FOUND')

    merged = {
        'as2Id': payload.get('as2Id', profile.as2_id),
        'as2Url': payload.get('as2Url', profile.as2_url),
        'as2Port': payload.get('as2Port', profile.as2_port),
        'senderId': payload.get('senderId', profile.sender_id),
        'senderQualifier': payload.get('senderQualifier', profile.sender_qualifier),
        'receiverId': payload.get('receiverId', profile.receiver_id),
        'receiverQualifier': payload.get('receiverQualifier', profile.receiver_qualifier),
    }
    valid_as2, as2_err = _validate_as2_profile(merged)
    if not valid_as2:
        return fail(as2_err or 'Invalid AS2 profile', 'PARTNER_VALIDATION')

    if payload.get('name') is not None:
        profile.name = str(payload.get('name') or '').strip() or profile.name
    if payload.get('as2Id') is not None:
        profile.as2_id = str(payload.get('as2Id') or '').strip()
    if payload.get('as2Url') is not None:
        profile.as2_url = str(payload.get('as2Url') or '').strip()
    profile.as2_port = int(merged['as2Port'])
    profile.sender_id = str(merged['senderId']).strip()
    profile.sender_qualifier = str(merged['senderQualifier']).strip().upper()
    profile.receiver_id = str(merged['receiverId']).strip()
    profile.receiver_qualifier = str(merged['receiverQualifier']).strip().upper()

    db.commit()
    partner = load_partner_with_relations(db, partner_id)
    if partner is not None:
        sync_action = _sync_action_for_partner(partner, SYNC_UPDATE)
        result = sync_partner_to_external(db, partner, sync_action)
        record_sync_result(db, partner, result)
        db.commit()
    db.refresh(profile)
    return ok(_serialize_as2_profile(profile))


@router.delete('/{partner_id}')
def delete_partner(
    partner_id: str,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = load_partner_with_relations(db, partner_id)
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    if not p.external_partner_id and not p.external_last_attempt_at and p.external_sync_status != SYNC_SYNCED:
        db.delete(p)
        db.commit()
        return ok({'deleted': True})
    if not p.external_partner_id:
        p.external_partner_sync_status = SYNC_NOT_SYNCED
        p.external_sync_status = SYNC_FAILED
        p.external_pending_action = None
        p.external_last_error = 'External partner id is missing; partner was retained so remote deletion can be checked manually'
        db.commit()
        db.refresh(p)
        return ok({'deleted': False, 'partner': partner_to_api(p)})
    result = sync_partner_to_external(db, p, SYNC_DELETE)
    record_sync_result(db, p, result)
    if result.ok:
        db.delete(p)
    db.commit()
    if result.ok:
        return ok({'deleted': True})
    db.refresh(p)
    return ok({'deleted': False, 'partner': partner_to_api(p)})


@router.post('/{partner_id}/external-sync/retry')
def retry_external_sync(
    partner_id: str,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    p = load_partner_with_relations(db, partner_id)
    if not p:
        return fail('Partner not found', 'PARTNER_NOT_FOUND')
    action = p.external_pending_action or _sync_action_for_partner(p, SYNC_UPDATE)
    result = sync_partner_to_external(db, p, action)
    record_sync_result(db, p, result)
    if result.ok and action == SYNC_DELETE:
        db.delete(p)
        db.commit()
        return ok({'deleted': True})
    db.commit()
    db.refresh(p)
    return ok(partner_to_api(p))
