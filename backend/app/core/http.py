from __future__ import annotations
from collections import defaultdict, deque
from datetime import datetime
from time import monotonic
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import APICallLog

EXEMPT_PATHS = {'/health', '/v1/meta/health'}


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get('x-forwarded-for', '').strip()
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.client.host if request.client else 'unknown'


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        if settings.cookie_secure:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        # keep health checks unrestricted
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        # 开发环境关闭限流，避免 Dashboard 多请求触发 429
        if getattr(settings, 'app_env', 'production') == 'development':
            return await call_next(request)

        key = _client_ip(request) + ':' + request.url.path
        now = monotonic()
        bucket = self.hits[key]
        while bucket and now - bucket[0] > self.window_seconds:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={'success': False, 'error': 'Too many requests', 'code': 'RATE_LIMITED'},
            )

        bucket.append(now)
        return await call_next(request)


class RequestGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        allowed_ips = settings.parsed_api_ip_allowlist
        if allowed_ips:
            ip = _client_ip(request)
            if ip not in allowed_ips:
                return JSONResponse(
                    status_code=403,
                    content={'success': False, 'error': 'IP not allowed', 'code': 'IP_NOT_ALLOWED'},
                )

        content_length = request.headers.get('content-length')
        if content_length:
            try:
                if int(content_length) > settings.api_max_request_size_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={'success': False, 'error': 'Payload too large', 'code': 'PAYLOAD_TOO_LARGE'},
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={'success': False, 'error': 'Invalid content-length', 'code': 'INVALID_CONTENT_LENGTH'},
                )
        return await call_next(request)


class TraceAndAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get('x-trace-id') or uuid4().hex
        request.state.trace_id = trace_id
        start = monotonic()
        response = await call_next(request)
        latency_ms = int((monotonic() - start) * 1000)
        response.headers['x-trace-id'] = trace_id

        client_id = getattr(request.state, 'api_client_id', None)
        auth_kind = getattr(request.state, 'auth_kind', None)
        if auth_kind in {'oauth', 'api_key'}:
            db = SessionLocal()
            try:
                db.add(
                    APICallLog(
                        trace_id=trace_id,
                        client_id=client_id,
                        method=request.method,
                        path=request.url.path,
                        status_code=response.status_code,
                        latency_ms=latency_ms,
                        created_at=datetime.utcnow(),
                    )
                )
                db.commit()
            finally:
                db.close()
        return response
