from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_oauth_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import APIClient, OAuthToken
from app.schemas.common import ok

router = APIRouter(prefix='/v1/oauth', tags=['oauth'])


def require_oauth_admin(admin_key: str | None = Header(default=None, alias='x-admin-key')) -> None:
    if not settings.oauth_admin_key or admin_key != settings.oauth_admin_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid admin key')


@router.post('/token')
def issue_token(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
    scope: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    if grant_type != 'client_credentials':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Unsupported grant_type')

    client = db.query(APIClient).filter(APIClient.client_id == client_id, APIClient.status == 'active').first()
    if not client or not verify_password(client_secret, client.secret_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid client credentials')

    requested_scopes = set((scope or '').split()) if scope else set(client.scopes or [])
    if requested_scopes and not requested_scopes.issubset(set(client.scopes or [])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Requested scope not allowed')
    final_scopes = sorted(requested_scopes) if requested_scopes else sorted(set(client.scopes or []))

    access_token, expires_at, jti = create_oauth_access_token(client_id, final_scopes, client.environment)
    db.add(OAuthToken(jti=jti, client_id=client_id, expires_at=expires_at.replace(tzinfo=None), revoked=False))
    client.last_used_at = datetime.utcnow()
    db.commit()

    return ok(
        {
            'access_token': access_token,
            'token_type': 'bearer',
            'expires_in': int((expires_at.replace(tzinfo=None) - datetime.utcnow()).total_seconds()),
            'scope': ' '.join(final_scopes),
        }
    )


@router.post('/revoke')
def revoke_token(token: str = Form(...), db: Session = Depends(get_db)):
    from app.core.security import decode_oauth_access_token

    payload = decode_oauth_access_token(token)
    if payload:
        row = db.query(OAuthToken).filter(OAuthToken.jti == payload['jti']).first()
        if row:
            row.revoked = True
            db.commit()
    return ok({'revoked': True})


@router.post('/clients')
def create_api_client(
    name: str = Form(...),
    scopes: str = Form(...),
    environment: str = Form(default='production'),
    db: Session = Depends(get_db),
    _admin: None = Depends(require_oauth_admin),
):
    if environment not in {'production', 'sandbox', 'all'}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid environment')
    client_id = f'cli_{uuid4().hex[:20]}'
    client_secret = uuid4().hex + uuid4().hex[:8]
    client = APIClient(
        client_id=client_id,
        name=name,
        secret_hash=hash_password(client_secret),
        status='active',
        scopes=sorted({s.strip() for s in scopes.split(' ') if s.strip()}),
        environment=environment,
    )
    db.add(client)
    db.commit()
    return ok({'client_id': client_id, 'client_secret': client_secret, 'scopes': client.scopes, 'environment': client.environment})


@router.get('/clients')
def list_api_clients(
    db: Session = Depends(get_db),
    _admin: None = Depends(require_oauth_admin),
):
    rows = db.query(APIClient).order_by(APIClient.created_at.desc()).all()
    return ok(
        [
            {
                'client_id': r.client_id,
                'name': r.name,
                'status': r.status,
                'scopes': r.scopes or [],
                'environment': r.environment,
                'created_at': r.created_at.isoformat() if r.created_at else None,
                'last_used_at': r.last_used_at.isoformat() if r.last_used_at else None,
            }
            for r in rows
        ]
    )


@router.put('/clients/{client_id}/status')
def update_api_client_status(
    client_id: str,
    status_value: str = Form(..., alias='status'),
    db: Session = Depends(get_db),
    _admin: None = Depends(require_oauth_admin),
):
    if status_value not in {'active', 'disabled'}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid status')
    row = db.query(APIClient).filter(APIClient.client_id == client_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client not found')
    row.status = status_value
    if status_value == 'disabled':
        db.query(OAuthToken).filter(OAuthToken.client_id == client_id, OAuthToken.revoked.is_(False)).update({'revoked': True})
    db.commit()
    return ok({'client_id': row.client_id, 'status': row.status})


@router.post('/clients/{client_id}/rotate-secret')
def rotate_api_client_secret(
    client_id: str,
    db: Session = Depends(get_db),
    _admin: None = Depends(require_oauth_admin),
):
    row = db.query(APIClient).filter(APIClient.client_id == client_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Client not found')
    client_secret = uuid4().hex + uuid4().hex[:8]
    row.secret_hash = hash_password(client_secret)
    db.query(OAuthToken).filter(OAuthToken.client_id == client_id, OAuthToken.revoked.is_(False)).update({'revoked': True})
    db.commit()
    return ok({'client_id': row.client_id, 'client_secret': client_secret, 'rotated': True})
