from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from sqlalchemy import inspect, text

from app.core.config import settings
from app.core.http import RateLimitMiddleware, RequestGuardMiddleware, SecurityHeadersMiddleware, TraceAndAuditMiddleware
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.routers import api_docs, auth, certificates, connection_testing, health, integrations, meta, notifications, oauth, partners, specifications, transactions
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
        inspector = inspect(engine)
        if 'tp_specifications' in inspector.get_table_names():
            columns = {c['name'] for c in inspector.get_columns('tp_specifications')}
            if 'status' not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE tp_specifications ADD COLUMN status VARCHAR(16) DEFAULT 'active'"))
                    conn.execute(text("UPDATE tp_specifications SET status='active' WHERE status IS NULL"))
        if 'transactions' in inspector.get_table_names():
            columns = {c['name'] for c in inspector.get_columns('transactions')}
            alters = []
            if 'doc_type' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN doc_type VARCHAR(20)")
            if 'source_system' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN source_system VARCHAR(20) DEFAULT 'manual'")
            if 'external_event_id' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN external_event_id VARCHAR(120)")
            if 'idempotency_key' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN idempotency_key VARCHAR(120)")
            if 'business_refs' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN business_refs JSON DEFAULT '{}'")
            if 'control_refs' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN control_refs JSON DEFAULT '{}'")
            if 'occurred_at' not in columns:
                alters.append("ALTER TABLE transactions ADD COLUMN occurred_at DATETIME")
            if alters:
                with engine.begin() as conn:
                    for stmt in alters:
                        conn.execute(text(stmt))
                    conn.execute(text("UPDATE transactions SET doc_type=type WHERE doc_type IS NULL"))
                    conn.execute(text("UPDATE transactions SET source_system='manual' WHERE source_system IS NULL"))
                    conn.execute(text("UPDATE transactions SET business_refs='{}' WHERE business_refs IS NULL"))
                    conn.execute(text("UPDATE transactions SET control_refs='{}' WHERE control_refs IS NULL"))
                    conn.execute(text("UPDATE transactions SET occurred_at=created_at WHERE occurred_at IS NULL"))
            if 'integration_type' not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN integration_type VARCHAR(16)"))
            if 'channel' not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE transactions ADD COLUMN channel VARCHAR(20)"))
        if 'users' in inspector.get_table_names():
            columns = {c['name'] for c in inspector.get_columns('users')}
            if 'password_algo' not in columns:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN password_algo VARCHAR(16) DEFAULT 'pbkdf2'"))
                    conn.execute(text("UPDATE users SET password_algo='pbkdf2' WHERE password_algo IS NULL"))
        if 'partners' in inspector.get_table_names():
            columns = {c['name'] for c in inspector.get_columns('partners')}
            alters = []
            if 'integration_type' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN integration_type VARCHAR(16) DEFAULT 'edi'")
            if 'communication_channel' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN communication_channel VARCHAR(20)")
            if 'current_step_id' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN current_step_id INTEGER DEFAULT 1")
            if 'onboarding_start_date' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN onboarding_start_date VARCHAR(10)")
            if 'step_completion_dates' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN step_completion_dates JSON DEFAULT '{}'")
            if 'api_config' not in columns:
                alters.append("ALTER TABLE partners ADD COLUMN api_config JSON")
            if alters:
                with engine.begin() as conn:
                    for stmt in alters:
                        conn.execute(text(stmt))
    if settings.auto_seed:
        db = SessionLocal()
        try:
            seed_if_empty(db)
        finally:
            db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestGuardMiddleware)
if settings.app_env != "development":
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
app.add_middleware(TraceAndAuditMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.warning("Request validation failed: %s", exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Invalid request",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
        },
    )

app.include_router(health.router)
app.include_router(meta.router)
app.include_router(oauth.router)
app.include_router(auth.router)
app.include_router(partners.router)
app.include_router(certificates.router)
app.include_router(transactions.router)
app.include_router(notifications.router)
app.include_router(specifications.router)
app.include_router(integrations.router)
app.include_router(api_docs.router)
app.include_router(connection_testing.router)
