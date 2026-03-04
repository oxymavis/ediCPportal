from __future__ import annotations
import re
import secrets
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import EmailVerificationToken, Session as UserSession, User
from app.schemas.auth import LoginRequest, RegisterRequest, VerifyEmailConfirmRequest, VerifyEmailRequest
from app.schemas.common import fail, ok
from app.services.deps import get_current_user, require_csrf
from app.services.email import send_verification_email

router = APIRouter(prefix='/v1/auth', tags=['auth'])


PASSWORD_UPPER_RE = re.compile(r'[A-Z]')
PASSWORD_NUMBER_RE = re.compile(r'\d')


def _is_secure_request(request: Request) -> bool:
    if settings.cookie_secure:
        return True
    return request.headers.get('x-forwarded-proto', '').strip().lower() == 'https'


def set_session_cookie(response: Response, token: str, expires_at: datetime, secure: bool | None = None) -> None:
    use_secure = secure if secure is not None else settings.cookie_secure
    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=use_secure,
        samesite=settings.cookie_samesite,
        expires=int(expires_at.timestamp()),
        path='/',
    )


def set_csrf_cookie(response: Response, csrf_token: str, expires_at: datetime, secure: bool | None = None) -> None:
    use_secure = secure if secure is not None else settings.cookie_secure
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        secure=use_secure,
        samesite=settings.cookie_samesite,
        expires=int(expires_at.timestamp()),
        path='/',
    )


@router.post('/register')
def register(
    request: Request,
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if not PASSWORD_UPPER_RE.search(payload.password) or not PASSWORD_NUMBER_RE.search(payload.password):
        return fail('Password must contain at least 1 uppercase letter and 1 number', 'AUTH_WEAK_PASSWORD')
    if payload.confirmPassword is not None and payload.password != payload.confirmPassword:
        return fail('Passwords do not match', 'AUTH_PASSWORD_MISMATCH')

    email = payload.email.strip().lower()
    exists = db.query(User).filter(User.email == email).first()
    if exists:
        return fail('Email already registered', 'AUTH_EMAIL_EXISTS')

    user = User(
        id=str(uuid4()),
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()

    token, expires_at = create_access_token(user.id, payload.rememberMe)
    csrf_token = secrets.token_urlsafe(24)
    db.add(UserSession(id=token, user_id=user.id, expires_at=expires_at.replace(tzinfo=None)))

    verify_token = secrets.token_urlsafe(32)
    db.add(
        EmailVerificationToken(
            token=verify_token,
            user_id=user.id,
            expires_at=(datetime.utcnow() + timedelta(hours=24)),
            used=False,
        )
    )
    db.commit()

    send_verification_email(email, verify_token)

    secure = _is_secure_request(request)
    set_session_cookie(response, token, expires_at, secure=secure)
    set_csrf_cookie(response, csrf_token, expires_at, secure=secure)
    return ok(
        {
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'emailVerified': user.email_verified,
            }
        }
    )


@router.post('/login')
def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        return fail('Invalid email or password', 'AUTH_INVALID_CREDENTIALS')

    token, expires_at = create_access_token(user.id, payload.rememberMe)
    csrf_token = secrets.token_urlsafe(24)
    db.add(UserSession(id=token, user_id=user.id, expires_at=expires_at.replace(tzinfo=None)))
    db.commit()

    secure = _is_secure_request(request)
    set_session_cookie(response, token, expires_at, secure=secure)
    set_csrf_cookie(response, csrf_token, expires_at, secure=secure)
    return ok(
        {
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'emailVerified': user.email_verified,
            }
        }
    )


@router.post('/logout')
def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    db.commit()
    response.delete_cookie(settings.cookie_name, path='/')
    response.delete_cookie(settings.csrf_cookie_name, path='/')
    return ok({'loggedOut': True})


@router.get('/me')
def me(response: Response, current_user: User = Depends(get_current_user)):
    csrf_token = secrets.token_urlsafe(24)
    expires_at = datetime.utcnow() + timedelta(hours=settings.access_token_ttl_hours)
    set_csrf_cookie(response, csrf_token, expires_at)
    return ok(
        {
            'user': {
                'id': current_user.id,
                'name': current_user.name,
                'email': current_user.email,
                'emailVerified': current_user.email_verified,
            }
        }
    )


@router.post('/verify-email/request')
def request_verification(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user:
        return ok({'sent': True})

    token = secrets.token_urlsafe(32)
    db.add(
        EmailVerificationToken(
            token=token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            used=False,
        )
    )
    db.commit()

    send_verification_email(user.email, token)

    return ok({'sent': True})


@router.post('/verify-email/confirm')
def confirm_verification(payload: VerifyEmailConfirmRequest, db: Session = Depends(get_db)):
    token = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token == payload.token, EmailVerificationToken.used.is_(False))
        .first()
    )
    if not token or token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid or expired token')

    user = db.query(User).filter(User.id == token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

    user.email_verified = True
    token.used = True
    db.commit()
    return ok({'verified': True})
