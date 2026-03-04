from __future__ import annotations
from datetime import datetime, timedelta, timezone
import secrets
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(
    schemes=['pbkdf2_sha256'],
    deprecated='auto',
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(subject: str, remember_me: bool = False) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expires_delta = timedelta(days=settings.remember_me_ttl_days) if remember_me else timedelta(hours=settings.access_token_ttl_hours)
    expires_at = now + expires_delta
    payload: dict[str, Any] = {
        'sub': subject,
        'iat': int(now.timestamp()),
        'exp': int(expires_at.timestamp()),
        'jti': secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, settings.auth_secret, algorithm=settings.auth_algorithm), expires_at


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.auth_secret, algorithms=[settings.auth_algorithm])
    except JWTError:
        return None


def create_oauth_access_token(client_id: str, scopes: list[str], environment: str) -> tuple[str, datetime, str]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.oauth_access_token_ttl_minutes)
    jti = secrets.token_urlsafe(12)
    payload: dict[str, Any] = {
        'sub': client_id,
        'typ': 'client',
        'scope': ' '.join(scopes),
        'env': environment,
        'iat': int(now.timestamp()),
        'exp': int(expires_at.timestamp()),
        'jti': jti,
    }
    return jwt.encode(payload, settings.auth_secret, algorithm=settings.auth_algorithm), expires_at, jti


def decode_oauth_access_token(token: str) -> dict[str, Any] | None:
    payload = decode_access_token(token)
    if not payload:
        return None
    if payload.get('typ') != 'client':
        return None
    if 'sub' not in payload or 'jti' not in payload:
        return None
    return payload
