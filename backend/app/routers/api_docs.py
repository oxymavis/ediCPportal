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


@router.put('/messages/{code}/schema')
def upsert_message_schema(code: str, payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    if not db.query(APIMessage).filter(APIMessage.code == code).first():
        return fail('Message not found', 'API_DOC_NOT_FOUND')
    version = (payload.get('version') or 'v1').strip()
    schema = payload.get('schema')
    if not isinstance(schema, dict):
        return fail('schema must be a JSON object', 'API_DOC_VALIDATION')
    row = (
        db.query(APIMessageSchema)
        .filter(APIMessageSchema.message_code == code, APIMessageSchema.version == version)
        .first()
    )
    if row:
        row.schema = schema
    else:
        row = APIMessageSchema(message_code=code, version=version, schema=schema)
        db.add(row)
    db.commit()
    return ok({'upserted': True, 'messageCode': code, 'version': version})


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


@router.put('/messages/{code}/mapping')
def replace_message_mapping(code: str, payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    if not db.query(APIMessage).filter(APIMessage.code == code).first():
        return fail('Message not found', 'API_DOC_NOT_FOUND')
    mappings = payload.get('mappings')
    if not isinstance(mappings, list):
        return fail('mappings must be an array', 'API_DOC_VALIDATION')
    db.query(APIMessageMapping).filter(APIMessageMapping.message_code == code).delete()
    for m in mappings:
        if not isinstance(m, dict) or not m.get('jsonField') or not m.get('x12Segment'):
            return fail('Each mapping requires jsonField and x12Segment', 'API_DOC_VALIDATION')
        db.add(
            APIMessageMapping(
                message_code=code,
                json_field=m['jsonField'],
                x12_segment=m['x12Segment'],
                x12_element=m.get('x12Element'),
                notes=m.get('notes'),
            )
        )
    db.commit()
    return ok({'upserted': True, 'count': len(mappings)})


@router.get('/messages/{code}/samples')
def get_message_samples(code: str, db: Session = Depends(get_db)):
    rows = db.query(APIMessageSample).filter(APIMessageSample.message_code == code).all()
    return ok([{'type': r.sample_type, 'content': r.content} for r in rows])


@router.put('/messages/{code}/samples')
def replace_message_samples(code: str, payload: dict, _csrf: None = Depends(require_csrf), db: Session = Depends(get_db)):
    if not db.query(APIMessage).filter(APIMessage.code == code).first():
        return fail('Message not found', 'API_DOC_NOT_FOUND')
    samples = payload.get('samples')
    if not isinstance(samples, list):
        return fail('samples must be an array', 'API_DOC_VALIDATION')
    db.query(APIMessageSample).filter(APIMessageSample.message_code == code).delete()
    for s in samples:
        if not isinstance(s, dict) or s.get('type') not in {'request', 'response'}:
            return fail('Each sample requires type=request|response', 'API_DOC_VALIDATION')
        db.add(APIMessageSample(message_code=code, sample_type=s['type'], content=s.get('content') or {}))
    db.commit()
    return ok({'upserted': True, 'count': len(samples)})
