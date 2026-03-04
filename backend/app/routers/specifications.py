from __future__ import annotations
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import TpSpecification, UnisSpecification
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope
from app.services.mappers import tp_spec_to_api, unis_to_api
from app.services.storage import resolve_relative_path, save_binary_file, save_text_file

router = APIRouter(prefix='/v1/specifications', tags=['specifications'], dependencies=[Depends(get_actor), Depends(require_scope('specifications'))])
ALLOWED_SPEC_FILE_TYPES = {'PDF', 'EXCEL', 'JSON', 'XML', 'X12', 'TXT'}
ALLOWED_SPEC_STATUS = {'active', 'inactive'}


def _set_active_spec(db: Session, spec: TpSpecification) -> None:
    spec.status = 'active'
    db.query(TpSpecification).filter(
        TpSpecification.partner == spec.partner,
        TpSpecification.partner_code == spec.partner_code,
        TpSpecification.message_type == spec.message_type,
        TpSpecification.id != spec.id,
    ).update({'status': 'inactive'})


@router.get('')
def get_specifications(
    section: str = 'all',
    category: str = 'all',
    partner: str = 'all',
    partnerCode: str = 'all',
    messageType: str = 'all',
    search: str = '',
    db: Session = Depends(get_db),
):
    if section in {'all', 'unis'}:
        q = db.query(UnisSpecification)
        if category != 'all':
            q = q.filter(UnisSpecification.category.ilike(category))
        unis = [unis_to_api(s) for s in q.all()]
        if section == 'unis':
            return ok(unis)
    else:
        unis = []

    tp_q = db.query(TpSpecification)
    if partner != 'all':
        tp_q = tp_q.filter((TpSpecification.partner == partner) | (TpSpecification.partner_code == partner))
    if partnerCode != 'all':
        tp_q = tp_q.filter(TpSpecification.partner_code == partnerCode)
    if messageType != 'all':
        tp_q = tp_q.filter(TpSpecification.message_type == messageType)
    rows = tp_q.all()
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.message_type.lower() or s in r.message_name.lower() or s in r.partner.lower() or s in r.file_name.lower()]
    rows = sorted(rows, key=lambda r: f'{r.uploaded_date}{r.created_at.isoformat()}', reverse=True)

    tp = [tp_spec_to_api(r) for r in rows]
    if section == 'tp':
        return ok(tp)
    if section == 'all':
        return ok({'unis': unis, 'tp': tp})
    return fail('Invalid section; use unis, tp, or omit', 'SPEC_INVALID_SECTION')


@router.post('')
def create_tp_specification(
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    required = ['messageType', 'partner', 'partnerCode', 'version']
    missing = [k for k in required if not payload.get(k)]
    if missing:
        return fail(f'Missing required fields: {", ".join(missing)}', 'SPEC_VALIDATION')
    file_type = (payload.get('fileType') or 'PDF').strip().upper()
    if file_type not in ALLOWED_SPEC_FILE_TYPES:
        return fail('Unsupported specification file type', 'SPEC_INVALID_FILE_TYPE')

    file_name = payload.get('fileName') or 'uploaded-file.txt'
    placeholder_text = (
        f"Specification metadata only\n"
        f"messageType={payload['messageType']}\n"
        f"messageName={payload.get('messageName') or payload['messageType']}\n"
        f"partner={payload['partner']}\n"
        f"partnerCode={payload['partnerCode']}\n"
        f"version={payload['version']}\n"
    )
    stored_path = save_text_file(placeholder_text, 'specifications', file_name)

    spec = TpSpecification(
        id=str(uuid4()),
        message_type=payload['messageType'].strip(),
        message_name=(payload.get('messageName') or payload['messageType']).strip(),
        partner=payload['partner'].strip(),
        partner_code=payload['partnerCode'].strip(),
        version=payload['version'].strip(),
        uploaded_date=payload.get('uploadedDate') or datetime.utcnow().strftime('%Y-%m-%d'),
        uploaded_by=payload.get('uploadedBy') or 'user@example.com',
        file_type=file_type,
        file_name=file_name,
        size=payload.get('size') or '0 KB',
        file_path=stored_path,
        status='active',
    )
    db.add(spec)
    db.flush()
    _set_active_spec(db, spec)
    db.commit()
    db.refresh(spec)
    return ok(tp_spec_to_api(spec))


@router.post('/upload')
async def upload_tp_specification(
    messageType: str = Form(...),
    partner: str = Form(...),
    partnerCode: str = Form(...),
    version: str = Form(...),
    messageName: str | None = Form(default=None),
    uploadedBy: str | None = Form(default='user@example.com'),
    file: UploadFile = File(...),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    original_name = file.filename or 'spec.txt'
    file_type = (original_name.split('.')[-1] if '.' in original_name else 'txt').upper()
    if file_type in {'XLSX', 'XLS'}:
        file_type = 'EXCEL'
    if file_type == 'EDI':
        file_type = 'X12'
    if file_type not in ALLOWED_SPEC_FILE_TYPES:
        return fail('Unsupported specification file type', 'SPEC_INVALID_FILE_TYPE')

    content = await file.read()
    stored_path = save_binary_file(content, 'specifications', original_name)
    size_kb = max(len(content) / 1024, 0.1)

    spec = TpSpecification(
        id=str(uuid4()),
        message_type=messageType.strip(),
        message_name=(messageName or messageType).strip(),
        partner=partner.strip(),
        partner_code=partnerCode.strip(),
        version=version.strip(),
        uploaded_date=datetime.utcnow().strftime('%Y-%m-%d'),
        uploaded_by=(uploadedBy or 'user@example.com').strip(),
        file_type=file_type,
        file_name=original_name,
        size=f'{size_kb:.1f} KB',
        file_path=stored_path,
        status='active',
    )
    db.add(spec)
    db.flush()
    _set_active_spec(db, spec)
    db.commit()
    db.refresh(spec)
    return ok(tp_spec_to_api(spec))


@router.get('/{spec_id}/download')
def download_tp_specification(spec_id: str, db: Session = Depends(get_db)):
    spec = db.query(TpSpecification).filter(TpSpecification.id == spec_id).first()
    if not spec:
        return fail('Specification not found', 'SPEC_NOT_FOUND')
    if not spec.file_path:
        return fail('Specification file is not available', 'SPEC_FILE_NOT_FOUND')
    abs_path = resolve_relative_path(spec.file_path)
    if not abs_path.exists() or not abs_path.is_file():
        return fail('Specification file is not available', 'SPEC_FILE_NOT_FOUND')
    return FileResponse(path=str(abs_path), filename=spec.file_name)


@router.put('/{spec_id}')
def update_tp_specification(
    spec_id: str,
    payload: dict,
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    spec = db.query(TpSpecification).filter(TpSpecification.id == spec_id).first()
    if not spec:
        return fail('Specification not found', 'SPEC_NOT_FOUND')

    status = (payload.get('status') or '').strip().lower()
    if status and status not in ALLOWED_SPEC_STATUS:
        return fail('Invalid specification status', 'SPEC_INVALID_STATUS')

    if status:
        spec.status = status
        if status == 'active':
            _set_active_spec(db, spec)

    db.commit()
    db.refresh(spec)
    return ok(tp_spec_to_api(spec))
