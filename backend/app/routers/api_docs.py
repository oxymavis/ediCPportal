from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import APIMessage, APIMessageMapping, APIMessageSample, APIMessageSchema
from app.schemas.common import fail, ok
from app.services.deps import get_actor, require_csrf, require_scope

router = APIRouter(prefix='/v1/api-docs', tags=['api-docs'], dependencies=[Depends(get_actor), Depends(require_scope('specifications'))])


@router.get('/messages')
def list_messages(category: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = db.query(APIMessage)
    if category and category != 'all':
        q = q.filter(APIMessage.category == category)
    rows = q.all()
    if search:
        s = search.lower()
        rows = [r for r in rows if s in r.code.lower() or s in r.name.lower()]
    return ok([
        {
            'code': r.code,
            'name': r.name,
            'category': r.category,
            'x12Equivalent': r.x12_equivalent,
            'version': r.version,
        }
        for r in rows
    ])


@router.get('/messages/{code}')
def get_message(code: str, db: Session = Depends(get_db)):
    row = db.query(APIMessage).filter(APIMessage.code == code).first()
    if not row:
        return fail('Message not found', 'API_DOC_NOT_FOUND')
    return ok(
        {
            'code': row.code,
            'name': row.name,
            'category': row.category,
            'x12Equivalent': row.x12_equivalent,
            'version': row.version,
        }
    )


@router.post('/messages')
def create_message(payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    code = (payload.get('code') or '').strip()
    name = (payload.get('name') or '').strip()
    if not code or not name:
        return fail('Missing required fields: code, name', 'API_DOC_VALIDATION')
    if db.query(APIMessage).filter(APIMessage.code == code).first():
        return fail('Message already exists', 'API_DOC_EXISTS')
    row = APIMessage(
        code=code,
        name=name,
        category=(payload.get('category') or 'general').strip(),
        x12_equivalent=payload.get('x12Equivalent'),
        version=(payload.get('version') or 'v1').strip(),
    )
    db.add(row)
    db.commit()
    return ok({'created': True, 'code': code})


@router.put('/messages/{code}')
def update_message(code: str, payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    row = db.query(APIMessage).filter(APIMessage.code == code).first()
    if not row:
        return fail('Message not found', 'API_DOC_NOT_FOUND')
    for key, attr in [
        ('name', 'name'),
        ('category', 'category'),
        ('x12Equivalent', 'x12_equivalent'),
        ('version', 'version'),
    ]:
        if payload.get(key) is not None:
            setattr(row, attr, payload.get(key))
    db.commit()
    return ok({'updated': True, 'code': code})


@router.get('/messages/{code}/schema')
def get_message_schema(code: str, db: Session = Depends(get_db)):
    row = db.query(APIMessageSchema).filter(APIMessageSchema.message_code == code).order_by(APIMessageSchema.id.desc()).first()
    return ok(row.schema if row else {})


@router.get('/messages/{code}/mapping')
def get_message_mapping(code: str, db: Session = Depends(get_db)):
    rows = db.query(APIMessageMapping).filter(APIMessageMapping.message_code == code).all()
    return ok(
        [
            {
                'jsonField': r.json_field,
                'x12Segment': r.x12_segment,
                'x12Element': r.x12_element,
                'notes': r.notes,
            }
            for r in rows
        ]
    )


@router.get('/messages/{code}/samples')
def get_message_samples(code: str, db: Session = Depends(get_db)):
    rows = db.query(APIMessageSample).filter(APIMessageSample.message_code == code).all()
    return ok([{'type': r.sample_type, 'content': r.content} for r in rows])
