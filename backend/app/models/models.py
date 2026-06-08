from __future__ import annotations
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    password_algo: Mapped[str] = mapped_column(String(16), default='pbkdf2')
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Session(Base):
    __tablename__ = 'sessions'

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailVerificationToken(Base):
    __tablename__ = 'email_verification_tokens'

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Partner(Base):
    __tablename__ = 'partners'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(20), index=True)
    partner_type: Mapped[str] = mapped_column(String(20), default='retailer')
    service_tier: Mapped[str] = mapped_column(String(20), default='standard')
    status: Mapped[str] = mapped_column(String(16), default='active')
    industry: Mapped[str] = mapped_column(String(50), default='retail')
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(120))
    contact_email: Mapped[str] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    integration_type: Mapped[str] = mapped_column(String(16), default='edi', index=True)
    communication_channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    current_step_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    onboarding_start_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    step_completion_dates: Mapped[dict] = mapped_column(JSON, default=dict)
    api_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    channel_config: Mapped[dict] = mapped_column(JSON, default=dict)
    external_partner_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    external_sync_status: Mapped[str] = mapped_column(String(20), default='not_synced', index=True)
    external_partner_sync_status: Mapped[str] = mapped_column(String(20), default='not_synced', index=True)
    external_certificate_sync_status: Mapped[str] = mapped_column(String(20), default='not_required', index=True)
    external_pending_action: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    external_last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    external_last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    external_last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    external_last_warning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    environment: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subsidiaries = relationship('Subsidiary', cascade='all, delete-orphan', back_populates='partner')
    sync_logs = relationship('PartnerSyncLog', cascade='all, delete-orphan', back_populates='partner')


class Subsidiary(Base):
    __tablename__ = 'subsidiaries'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    partner_id: Mapped[str] = mapped_column(ForeignKey('partners.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(30))
    region: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), default='active')
    supported_doc_types_x12: Mapped[list[str]] = mapped_column(JSON, default=list)
    supported_doc_types_edifact: Mapped[list[str]] = mapped_column(JSON, default=list)
    message_routing: Mapped[dict] = mapped_column(JSON, default=dict)

    partner = relationship('Partner', back_populates='subsidiaries')
    as2_profiles = relationship('AS2Profile', cascade='all, delete-orphan', back_populates='subsidiary')


class AS2Profile(Base):
    __tablename__ = 'as2_profiles'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    subsidiary_id: Mapped[str] = mapped_column(ForeignKey('subsidiaries.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(120))
    as2_id: Mapped[str] = mapped_column(String(128))
    as2_url: Mapped[str] = mapped_column(String(255))
    as2_port: Mapped[int] = mapped_column(Integer, default=443)
    sender_id: Mapped[str] = mapped_column(String(64), default='')
    sender_qualifier: Mapped[str] = mapped_column(String(8), default='ZZ')
    receiver_id: Mapped[str] = mapped_column(String(64), default='')
    receiver_qualifier: Mapped[str] = mapped_column(String(8), default='ZZ')
    status: Mapped[str] = mapped_column(String(16), default='active')
    encryption_cert: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    signing_cert: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mdn_required: Mapped[bool] = mapped_column(Boolean, default=True)
    mdn_signed: Mapped[bool] = mapped_column(Boolean, default=True)
    encryption_algorithm: Mapped[str] = mapped_column(String(30), default='AES-256')
    signature_algorithm: Mapped[str] = mapped_column(String(30), default='SHA-256')

    subsidiary = relationship('Subsidiary', back_populates='as2_profiles')


class Certificate(Base):
    __tablename__ = 'certificates'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255))
    serial_number: Mapped[str] = mapped_column(String(255))
    fingerprint: Mapped[str] = mapped_column(String(255))
    issuer: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(255))
    algorithm: Mapped[str] = mapped_column(String(50))
    key_size: Mapped[str] = mapped_column(String(20))
    created: Mapped[str] = mapped_column(String(10))
    expires: Mapped[str] = mapped_column(String(10))
    usage: Mapped[str] = mapped_column(String(50))
    type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(16), default='active')
    partner: Mapped[str] = mapped_column(String(120), index=True)
    environment: Mapped[str] = mapped_column(String(20), index=True)
    raw_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    __tablename__ = 'transactions'

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    type: Mapped[str] = mapped_column(String(20), index=True)
    doc_type: Mapped[Optional[str]] = mapped_column(String(20), index=True, nullable=True)
    type_name: Mapped[str] = mapped_column(String(120))
    partner: Mapped[str] = mapped_column(String(120), index=True)
    direction: Mapped[str] = mapped_column(String(16), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    time: Mapped[str] = mapped_column(String(8))
    size: Mapped[str] = mapped_column(String(20))
    records: Mapped[int] = mapped_column(Integer, default=0)
    control_number: Mapped[str] = mapped_column(String(50))
    sender_id: Mapped[str] = mapped_column(String(50))
    receiver_id: Mapped[str] = mapped_column(String(50))
    integration_type: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    channel: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    source_system: Mapped[str] = mapped_column(String(20), index=True, default='manual')
    external_event_id: Mapped[Optional[str]] = mapped_column(String(120), index=True, nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(120), unique=True, index=True, nullable=True)
    business_refs: Mapped[dict] = mapped_column(JSON, default=dict)
    control_refs: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    payload_format: Mapped[str] = mapped_column(String(20), default='text')
    raw: Mapped[str] = mapped_column(Text)
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    logs: Mapped[list] = mapped_column(JSON, default=list)
    errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    environment: Mapped[str] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TransactionLink(Base):
    __tablename__ = 'transaction_links'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_transaction_id: Mapped[str] = mapped_column(ForeignKey('transactions.id', ondelete='CASCADE'), index=True)
    to_transaction_id: Mapped[str] = mapped_column(ForeignKey('transactions.id', ondelete='CASCADE'), index=True)
    relation_type: Mapped[str] = mapped_column(String(20), index=True)
    match_rule: Mapped[str] = mapped_column(String(120))
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TransactionSystemEvent(Base):
    __tablename__ = 'transaction_system_events'
    __table_args__ = (UniqueConstraint('transaction_id', 'idempotency_key', name='uq_transaction_system_event_idempotency'),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    transaction_id: Mapped[str] = mapped_column(ForeignKey('transactions.id', ondelete='CASCADE'), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(120), index=True)
    system: Mapped[str] = mapped_column(String(80), index=True)
    stage: Mapped[str] = mapped_column(String(120), index=True)
    event_type: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    external_status: Mapped[str] = mapped_column(String(80))
    occurred_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    input_format: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    input_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_format: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    output_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    errors: Mapped[list[dict]] = mapped_column(JSON, default=list)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    event_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = 'notifications'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(16), index=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    date: Mapped[str] = mapped_column(String(10), index=True)
    time: Mapped[str] = mapped_column(String(8))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    environment: Mapped[str] = mapped_column(String(20), index=True)
    action: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UnisSpecification(Base):
    __tablename__ = 'unis_specifications'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80), index=True)
    version: Mapped[str] = mapped_column(String(30))
    last_updated: Mapped[str] = mapped_column(String(10))


class TpSpecification(Base):
    __tablename__ = 'tp_specifications'
    __table_args__ = (UniqueConstraint('partner', 'message_type', 'version', 'file_name', name='uq_tp_spec_history'),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    message_type: Mapped[str] = mapped_column(String(20), index=True)
    message_name: Mapped[str] = mapped_column(String(120))
    partner: Mapped[str] = mapped_column(String(120), index=True)
    partner_code: Mapped[str] = mapped_column(String(30), index=True)
    version: Mapped[str] = mapped_column(String(30))
    uploaded_date: Mapped[str] = mapped_column(String(10))
    uploaded_by: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))
    file_name: Mapped[str] = mapped_column(String(255))
    size: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(16), default='active')
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IntegrationClient(Base):
    __tablename__ = 'integration_clients'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    api_key_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default='active')
    allowed_sources: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class PartnerSyncLog(Base):
    __tablename__ = 'partner_sync_logs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    partner_id: Mapped[str] = mapped_column(ForeignKey('partners.id', ondelete='CASCADE'), index=True)
    action: Mapped[str] = mapped_column(String(16), index=True)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    request_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    response_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    result: Mapped[str] = mapped_column(String(16), index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    partner = relationship('Partner', back_populates='sync_logs')


class APIClient(Base):
    __tablename__ = 'api_clients'

    client_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    secret_hash: Mapped[str] = mapped_column(String(255))
    owner_user_id: Mapped[Optional[str]] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default='active')
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    environment: Mapped[str] = mapped_column(String(20), default='all')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class OAuthToken(Base):
    __tablename__ = 'oauth_tokens'

    jti: Mapped[str] = mapped_column(String(80), primary_key=True)
    client_id: Mapped[str] = mapped_column(ForeignKey('api_clients.client_id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class APICallLog(Base):
    __tablename__ = 'api_call_logs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    client_id: Mapped[Optional[str]] = mapped_column(String(80), index=True, nullable=True)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(255), index=True)
    status_code: Mapped[int] = mapped_column(Integer, index=True)
    latency_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class APIQuota(Base):
    __tablename__ = 'api_quotas'
    __table_args__ = (UniqueConstraint('client_id', 'period', 'period_key', name='uq_api_quota_period'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[str] = mapped_column(String(80), index=True)
    period: Mapped[str] = mapped_column(String(10), index=True)  # daily | monthly
    period_key: Mapped[str] = mapped_column(String(20), index=True)  # YYYY-MM-DD or YYYY-MM
    count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class APIMessage(Base):
    __tablename__ = 'api_messages'

    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(80), index=True)
    x12_equivalent: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    version: Mapped[str] = mapped_column(String(30), default='v1')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class APIMessageSchema(Base):
    __tablename__ = 'api_message_schemas'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_code: Mapped[str] = mapped_column(ForeignKey('api_messages.code', ondelete='CASCADE'), index=True)
    version: Mapped[str] = mapped_column(String(30), default='v1')
    schema: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class APIMessageSample(Base):
    __tablename__ = 'api_message_samples'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_code: Mapped[str] = mapped_column(ForeignKey('api_messages.code', ondelete='CASCADE'), index=True)
    sample_type: Mapped[str] = mapped_column(String(16), index=True)  # request|response
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class APIMessageMapping(Base):
    __tablename__ = 'api_message_mappings'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_code: Mapped[str] = mapped_column(ForeignKey('api_messages.code', ondelete='CASCADE'), index=True)
    json_field: Mapped[str] = mapped_column(String(255))
    x12_segment: Mapped[str] = mapped_column(String(50))
    x12_element: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConnectionTestRun(Base):
    __tablename__ = 'connection_test_runs'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    partner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    test_type: Mapped[str] = mapped_column(String(16), index=True)  # as2|api
    environment: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)  # passed|failed|partial
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class ConnectionTestStep(Base):
    __tablename__ = 'connection_test_steps'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey('connection_test_runs.id', ondelete='CASCADE'), index=True)
    step_no: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DocumentTestReport(Base):
    __tablename__ = 'document_test_reports'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    partner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    environment: Mapped[str] = mapped_column(String(20), index=True)
    message_type: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)  # passed|failed
    errors: Mapped[list] = mapped_column(JSON, default=list)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ValidatorReport(Base):
    __tablename__ = 'validator_reports'

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    format: Mapped[str] = mapped_column(String(16), index=True)  # x12|json|xml
    valid: Mapped[bool] = mapped_column(Boolean, default=False)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
