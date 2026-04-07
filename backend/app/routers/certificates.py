from __future__ import annotations
from datetime import datetime, timedelta
import hashlib
import base64
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import pkcs12
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Certificate, Partner
from app.schemas.common import fail, ok
from app.services.certificate_content import derive_certificate_raw_content, normalize_certificate_raw_content
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import certificate_to_api
from app.services.partner_external_sync import (
    SYNC_CREATE,
    SYNC_UPDATE,
    load_partner_with_relations,
    record_sync_result,
    sync_partner_to_external,
)
from app.services.storage import resolve_relative_path, save_binary_file, save_text_file

router = APIRouter(prefix='/v1/certificates', tags=['certificates'], dependencies=[Depends(get_actor), Depends(require_scope('certificates'))])

ALLOWED_CERT_EXTENSIONS = {'.pem', '.cer', '.crt', '.cert', '.pfx', '.p12'}


def compute_status(expires: str) -> str:
    try:
        exp = datetime.strptime(expires, '%Y-%m-%d')
    except ValueError:
        return 'active'
    now = datetime.utcnow()
    if exp < now:
        return 'expired'
    if exp <= now + timedelta(days=90):
        return 'expiring'
    return 'active'


def _dn_to_text(name: x509.Name) -> str:
    attrs = []
    for item in name:
        key = getattr(item.oid, '_name', None) or item.oid.dotted_string
        attrs.append(f'{key}={item.value}')
    return ', '.join(attrs)


def extract_certificate_metadata(file_bytes: bytes, filename: str | None) -> dict | None:
    if not file_bytes:
        return None

    lower_name = (filename or '').lower()
    cert_obj = None
    try:
        if lower_name.endswith('.p12') or lower_name.endswith('.pfx'):
            _, cert_obj, _ = pkcs12.load_key_and_certificates(file_bytes, password=None)
        else:
            if b'-----BEGIN CERTIFICATE-----' in file_bytes:
                cert_obj = x509.load_pem_x509_certificate(file_bytes)
            else:
                try:
                    cert_obj = x509.load_der_x509_certificate(file_bytes)
                except Exception:
                    cert_obj = x509.load_der_x509_certificate(base64.b64decode(file_bytes, validate=False))
    except Exception:
        return None

    if cert_obj is None:
        return None

    serial_hex = format(cert_obj.serial_number, 'X')
    fingerprint = cert_obj.fingerprint(hashes.SHA256()).hex().upper()
    fingerprint = ':'.join(fingerprint[i:i + 2] for i in range(0, len(fingerprint), 2))
    key_size = getattr(cert_obj.public_key(), 'key_size', None)
    algorithm = getattr(cert_obj.signature_hash_algorithm, 'name', None)
    if algorithm:
        algorithm = algorithm.upper()
    return {
        'serial_number': f'SN:{serial_hex}',
        'fingerprint': fingerprint,
        'issuer': _dn_to_text(cert_obj.issuer),
        'subject': _dn_to_text(cert_obj.subject),
        'algorithm': algorithm or 'SHA256',
        'key_size': str(key_size or 2048),
        'created': cert_obj.not_valid_before.strftime('%Y-%m-%d'),
        'expires': cert_obj.not_valid_after.strftime('%Y-%m-%d'),
    }


def _normalize_lookup(value: str | None) -> str:
    return ' '.join(str(value or '').split())


def _find_partner_for_certificate_link(db: Session, partner_name: str) -> Partner | None:
    normalized_name = _normalize_lookup(partner_name)
    if not normalized_name:
        return None
    return (
        db.query(Partner)
        .filter(func.lower(Partner.name) == normalized_name.lower())
        .order_by(Partner.created_at.desc())
        .first()
    )


def _build_external_sync_summary(
    partner: Partner | None,
    sync_triggered: bool,
    action: str | None = None,
    message: str | None = None,
) -> dict:
    if not partner:
        return {
            'triggered': False,
            'message': message or 'No linked partner found for certificate sync',
        }
    return {
        'triggered': sync_triggered,
        'action': action,
        'partnerRecordId': partner.id,
        'partnerName': partner.name,
        'externalPartnerId': partner.external_partner_id,
        'syncStatus': partner.external_sync_status,
        'partnerSyncStatus': getattr(partner, 'external_partner_sync_status', None),
        'certificateSyncStatus': getattr(partner, 'external_certificate_sync_status', None),
        'pendingAction': partner.external_pending_action,
        'lastError': partner.external_last_error,
        'lastWarning': getattr(partner, 'external_last_warning', None),
        'message': message,
    }


@router.get('')
def list_certificates(
    environment: str | None = None,
    status: str | None = None,
    partner: str | None = None,
    search: str | None = None,
    expiry: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Certificate)
    if environment:
        q = q.filter(Certificate.environment == environment)
    if status and status != 'all':
        q = q.filter(Certificate.status == status)
    if partner and partner != 'all':
        q = q.filter(Certificate.partner == partner)

    rows = q.all()
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.name.lower() or s in r.partner.lower() or s in r.serial_number.lower() or s in r.fingerprint.lower()]

    if expiry and expiry in {'30', '60', '90'}:
        days = int(expiry)
        now = datetime.utcnow()
        limit = now + timedelta(days=days)
        filtered = []
        for r in rows:
            try:
                d = datetime.strptime(r.expires, '%Y-%m-%d')
            except ValueError:
                continue
            if now <= d <= limit:
                filtered.append(r)
        rows = filtered

    return ok([certificate_to_api(r) for r in rows])


@router.get('/{cert_id}')
def get_certificate(cert_id: int, db: Session = Depends(get_db)):
    c = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not c:
        return fail('Certificate not found', 'CERT_NOT_FOUND')
    return ok(certificate_to_api(c))


@router.post('')
async def create_certificate(
    file: UploadFile | None = File(default=None),
    name: str | None = Form(default=None),
    partner: str | None = Form(default=None),
    usage: str | None = Form(default=None),
    type: str = Form(default='X.509'),
    environment: str | None = Form(default=None),
    rawContent: str | None = Form(default=None),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    file_bytes = b''
    stored_path: str | None = None
    normalized_name = _normalize_lookup(name)
    normalized_partner = _normalize_lookup(partner)
    normalized_usage = _normalize_lookup(usage)
    normalized_environment = _normalize_lookup(environment) or 'default'
    normalized_raw_content, decoded_raw_bytes = normalize_certificate_raw_content(rawContent)
    if file is not None:
        original_filename = file.filename or 'certificate.bin'
        filename = original_filename.lower()
        if not any(filename.endswith(ext) for ext in ALLOWED_CERT_EXTENSIONS):
            return fail('Unsupported certificate format', 'CERT_INVALID_FILE')
        file_bytes = await file.read()
        stored_path = save_binary_file(file_bytes, 'certificates', original_filename)
        if normalized_raw_content is None:
            normalized_raw_content, decoded_raw_bytes = derive_certificate_raw_content(file_bytes, original_filename)
    elif normalized_raw_content is not None:
        file_bytes = decoded_raw_bytes or normalized_raw_content.encode('utf-8')
        stored_path = save_text_file(normalized_raw_content, 'certificates', f'{(normalized_name or "certificate").replace(" ", "_")}.b64.txt')

    if not normalized_name or not normalized_partner or not normalized_usage:
        return fail('Missing required fields: name, partner, usage', 'CERT_VALIDATION')
    if not file_bytes and not normalized_raw_content:
        return fail('Certificate file or rawContent is required', 'CERT_VALIDATION')

    now = datetime.utcnow().strftime('%Y-%m-%d')
    expires = (datetime.utcnow() + timedelta(days=365)).strftime('%Y-%m-%d')
    metadata = extract_certificate_metadata(file_bytes, file.filename if file else None) if file_bytes else None
    if metadata is None:
        fallback_source = file_bytes or uuid4().bytes
        fingerprint = hashlib.sha256(fallback_source).hexdigest().upper()
        fingerprint = ':'.join(fingerprint[i:i + 2] for i in range(0, 64, 2))
        metadata = {
            'serial_number': f'SN:{uuid4().hex[:12].upper()}',
            'fingerprint': fingerprint,
            'issuer': 'Uploaded',
            'subject': f'CN={normalized_name}',
            'algorithm': 'SHA256',
            'key_size': '2048',
            'created': now,
            'expires': expires,
        }

    cert = Certificate(
        name=normalized_name,
        partner=normalized_partner,
        usage=normalized_usage,
        type=type,
        environment=normalized_environment,
        raw_content=normalized_raw_content,
        file_path=stored_path,
        serial_number=metadata['serial_number'],
        fingerprint=metadata['fingerprint'],
        issuer=metadata['issuer'],
        subject=metadata['subject'],
        algorithm=metadata['algorithm'],
        key_size=metadata['key_size'],
        created=metadata['created'],
        expires=metadata['expires'],
        status=compute_status(metadata['expires']),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    linked_partner: Partner | None = None
    sync_action: str | None = None
    external_sync_message: str | None = None
    partner_row = _find_partner_for_certificate_link(db, normalized_partner)
    if partner_row:
        full_partner = load_partner_with_relations(db, partner_row.id)
        if full_partner is not None:
            sync_action = SYNC_UPDATE if full_partner.external_partner_id else SYNC_CREATE
            sync_result = sync_partner_to_external(db, full_partner, sync_action)
            record_sync_result(db, full_partner, sync_result)
            db.commit()
            if full_partner.external_last_warning == 'Upload a certificate to start external sync':
                full_partner.external_last_warning = None
                db.commit()
            db.refresh(full_partner)
            linked_partner = full_partner
            external_sync_message = (
                'Certificate uploaded and partner sync was triggered'
                if sync_result.ok
                else (sync_result.error or 'Certificate uploaded, but partner sync failed')
            )
    else:
        external_sync_message = 'Certificate uploaded, but no matching partner was found for sync'
    payload = certificate_to_api(cert)
    payload['externalSync'] = _build_external_sync_summary(
        linked_partner,
        sync_triggered=linked_partner is not None,
        action=sync_action,
        message=external_sync_message,
    )
    return ok(payload)


@router.get('/{cert_id}/download')
def download_certificate(cert_id: int, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        return fail('Certificate not found', 'CERT_NOT_FOUND')
    if not cert.file_path:
        return fail('Certificate file is not available', 'CERT_FILE_NOT_FOUND')
    abs_path = resolve_relative_path(cert.file_path)
    if not abs_path.exists() or not abs_path.is_file():
        return fail('Certificate file is not available', 'CERT_FILE_NOT_FOUND')
    return FileResponse(path=str(abs_path), filename=f"{cert.name.replace(' ', '_')}{abs_path.suffix}")


@router.put('/{cert_id}')
def update_certificate(
    cert_id: int,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        return fail('Certificate not found', 'CERT_NOT_FOUND')

    for field, attr in [
        ('name', 'name'),
        ('serialNumber', 'serial_number'),
        ('fingerprint', 'fingerprint'),
        ('issuer', 'issuer'),
        ('subject', 'subject'),
        ('algorithm', 'algorithm'),
        ('keySize', 'key_size'),
        ('created', 'created'),
        ('expires', 'expires'),
        ('usage', 'usage'),
        ('type', 'type'),
        ('status', 'status'),
        ('partner', 'partner'),
        ('environment', 'environment'),
    ]:
        if payload.get(field) is not None:
            setattr(cert, attr, payload[field])

    if payload.get('rawContent') is not None:
        normalized_raw_content, _ = normalize_certificate_raw_content(payload.get('rawContent'))
        cert.raw_content = normalized_raw_content

    if payload.get('expires'):
        cert.status = compute_status(payload['expires'])

    db.commit()
    db.refresh(cert)
    return ok(certificate_to_api(cert))


@router.delete('/{cert_id}')
def delete_certificate(
    cert_id: int,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    cert = db.query(Certificate).filter(Certificate.id == cert_id).first()
    if not cert:
        return fail('Certificate not found', 'CERT_NOT_FOUND')
    db.delete(cert)
    db.commit()
    return ok({'deleted': True})
