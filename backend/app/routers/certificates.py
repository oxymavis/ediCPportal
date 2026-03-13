from __future__ import annotations
from datetime import datetime, timedelta
import hashlib
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import pkcs12
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Certificate
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import certificate_to_api
from app.services.storage import resolve_relative_path, save_binary_file

router = APIRouter(prefix='/v1/certificates', tags=['certificates'], dependencies=[Depends(get_actor), Depends(require_scope('certificates'))])

ALLOWED_CERT_EXTENSIONS = {'.pem', '.cer', '.crt', '.pfx', '.p12'}


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
                cert_obj = x509.load_der_x509_certificate(file_bytes)
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
    environment: str = Form(default='production'),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    file_bytes = b''
    stored_path: str | None = None
    if file is not None:
        original_filename = file.filename or 'certificate.bin'
        filename = original_filename.lower()
        if not any(filename.endswith(ext) for ext in ALLOWED_CERT_EXTENSIONS):
            return fail('Unsupported certificate format', 'CERT_INVALID_FILE')
        file_bytes = await file.read()
        stored_path = save_binary_file(file_bytes, 'certificates', original_filename)

    if not name or not partner or not usage:
        return fail('Missing required fields: name, partner, usage', 'CERT_VALIDATION')

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
            'subject': f'CN={name}',
            'algorithm': 'SHA256',
            'key_size': '2048',
            'created': now,
            'expires': expires,
        }

    cert = Certificate(
        name=name,
        partner=partner,
        usage=usage,
        type=type,
        environment=environment,
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
    return ok(certificate_to_api(cert))


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
