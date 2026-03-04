from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token, decode_oauth_access_token
from app.db.session import get_db
from app.models import APIClient, APIQuota, OAuthToken
from app.models import IntegrationClient
from app.models import Session as UserSession
from app.models import User

OAUTH_SCOPES = {
    'partners:read': 'Read partners and subsidiaries.',
    'partners:write': 'Create/update/delete partners and routing rules.',
    'certificates:read': 'Read and download certificates.',
    'certificates:write': 'Upload/update/delete certificates.',
    'specifications:read': 'Read and download specifications.',
    'specifications:write': 'Upload/update specification metadata.',
    'transactions:read': 'Read transaction lists, details, and related links.',
    'transactions:write': 'Create manual transactions.',
    'notifications:read': 'Read notifications.',
    'notifications:write': 'Update notification state.',
    'integrations:read': 'Read integration-facing transaction data.',
    'integrations:write': 'Push external integration events.',
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/v1/oauth/token', scopes=OAUTH_SCOPES, auto_error=False)
READ_METHODS = {'GET', 'HEAD', 'OPTIONS'}


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _get_cookie_user(db: Session, session_token: str | None) -> User | None:
    if not session_token:
        return None

    payload = decode_access_token(session_token)
    if not payload or 'sub' not in payload:
        return None

    db_session = db.query(UserSession).filter(UserSession.id == session_token).first()
    if not db_session:
        return None

    if db_session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        db.delete(db_session)
        db.commit()
        return None

    user = db.query(User).filter(User.id == payload['sub']).first()
    return user


def _check_quota(db: Session, client_id: str) -> None:
    now = datetime.utcnow()
    daily_key = now.strftime('%Y-%m-%d')
    monthly_key = now.strftime('%Y-%m')

    daily = db.query(APIQuota).filter(APIQuota.client_id == client_id, APIQuota.period == 'daily', APIQuota.period_key == daily_key).first()
    if not daily:
        daily = APIQuota(client_id=client_id, period='daily', period_key=daily_key, count=0)
        db.add(daily)
        db.flush()

    monthly = db.query(APIQuota).filter(APIQuota.client_id == client_id, APIQuota.period == 'monthly', APIQuota.period_key == monthly_key).first()
    if not monthly:
        monthly = APIQuota(client_id=client_id, period='monthly', period_key=monthly_key, count=0)
        db.add(monthly)
        db.flush()

    if daily.count >= settings.api_daily_quota or monthly.count >= settings.api_monthly_quota:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail='API quota exceeded')

    daily.count += 1
    monthly.count += 1
    db.commit()


def _get_oauth_client(db: Session, bearer_token: str | None) -> tuple[APIClient, set[str]] | None:
    if not bearer_token:
        return None

    payload = decode_oauth_access_token(bearer_token)
    if not payload:
        return None

    client = db.query(APIClient).filter(APIClient.client_id == payload['sub'], APIClient.status == 'active').first()
    if not client:
        return None

    token_row = db.query(OAuthToken).filter(OAuthToken.jti == payload['jti'], OAuthToken.revoked.is_(False)).first()
    if not token_row:
        return None
    if token_row.expires_at < datetime.utcnow():
        token_row.revoked = True
        db.commit()
        return None

    client.last_used_at = datetime.utcnow()
    db.commit()

    _check_quota(db, client.client_id)

    scope_text = payload.get('scope') or ''
    scopes = {s for s in scope_text.split(' ') if s}
    return client, scopes


def _get_api_key_client(db: Session, api_key: str | None) -> IntegrationClient | None:
    if not api_key or not settings.oauth_enable_api_key_fallback:
        return None

    api_key_hash = _sha256_hex(api_key)
    client = db.query(IntegrationClient).filter(IntegrationClient.api_key_hash == api_key_hash, IntegrationClient.status == 'active').first()
    if client:
        client.last_used_at = datetime.utcnow()
        db.commit()
        return client

    for key in settings.parsed_integration_api_keys:
        if hmac.compare_digest(api_key, key):
            return IntegrationClient(id='env-api-key', name='env-key', api_key_hash=api_key_hash, status='active', allowed_sources=['*'])
    return None


def get_current_user(
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.cookie_name),
) -> User:
    user = _get_cookie_user(db, session_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')
    return user


def get_actor(
    request: Request,
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Header(default=None, alias='x-api-key'),
    session_token: str | None = Cookie(default=None, alias=settings.cookie_name),
):
    oauth_client = _get_oauth_client(db, bearer_token)
    if oauth_client:
        client, scopes = oauth_client
        request.state.auth_kind = 'oauth'
        request.state.api_client_id = client.client_id
        request.state.oauth_scopes = scopes
        return {'kind': 'oauth', 'client': client, 'scopes': scopes}

    key_client = _get_api_key_client(db, api_key)
    if key_client:
        request.state.auth_kind = 'api_key'
        request.state.api_client_id = key_client.id
        request.state.oauth_scopes = {'integrations:write', 'integrations:read'}
        return {'kind': 'api_key', 'client': key_client, 'scopes': {'integrations:write', 'integrations:read'}}

    user = _get_cookie_user(db, session_token)
    if user:
        request.state.auth_kind = 'user'
        request.state.api_client_id = None
        request.state.oauth_scopes = set()
        return {'kind': 'user', 'user': user, 'scopes': {'*'}}

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Unauthorized')


def require_scope(resource: str):
    async def _dep(request: Request, actor=Depends(get_actor)):
        if actor['kind'] == 'user':
            return None

        action = 'read' if request.method.upper() in READ_METHODS else 'write'
        expected = f'{resource}:{action}'
        if expected not in actor['scopes'] and f'{resource}:*' not in actor['scopes'] and '*' not in actor['scopes']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Insufficient scope')

    return _dep


def require_csrf(
    request: Request,
    db: Session = Depends(get_db),
    bearer_token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Header(default=None, alias='x-api-key'),
    csrf_cookie: str | None = Cookie(default=None, alias=settings.csrf_cookie_name),
    csrf_header: str | None = Header(default=None, alias=settings.csrf_header_name),
) -> None:
    # OAuth/API key clients are exempt from CSRF because they are not cookie-session browser flows
    if getattr(request.state, 'auth_kind', None) in {'oauth', 'api_key'}:
        return
    if _get_oauth_client(db, bearer_token) or _get_api_key_client(db, api_key):
        return

    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='CSRF validation failed')


def require_integration_client(
    actor=Depends(get_actor),
):
    if actor['kind'] in {'oauth', 'api_key'}:
        return actor
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing API client credentials')
