"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table(
        'sessions',
        sa.Column('id', sa.String(128), primary_key=True),
        sa.Column('user_id', sa.String(64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'email_verification_tokens',
        sa.Column('token', sa.String(128), primary_key=True),
        sa.Column('user_id', sa.String(64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        'partners',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('industry', sa.String(50), nullable=False),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('contact_name', sa.String(120), nullable=False),
        sa.Column('contact_email', sa.String(255), nullable=False),
        sa.Column('contact_phone', sa.String(30), nullable=True),
        sa.Column('environment', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'subsidiaries',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('partner_id', sa.String(64), sa.ForeignKey('partners.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('region', sa.String(80), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('supported_doc_types_x12', sa.JSON(), nullable=False),
        sa.Column('supported_doc_types_edifact', sa.JSON(), nullable=False),
        sa.Column('message_routing', sa.JSON(), nullable=False),
    )

    op.create_table(
        'as2_profiles',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('subsidiary_id', sa.String(64), sa.ForeignKey('subsidiaries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('as2_id', sa.String(128), nullable=False),
        sa.Column('as2_url', sa.String(255), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('encryption_cert', sa.String(255), nullable=True),
        sa.Column('signing_cert', sa.String(255), nullable=True),
        sa.Column('mdn_required', sa.Boolean(), nullable=False),
        sa.Column('mdn_signed', sa.Boolean(), nullable=False),
        sa.Column('encryption_algorithm', sa.String(30), nullable=False),
        sa.Column('signature_algorithm', sa.String(30), nullable=False),
    )

    op.create_table(
        'certificates',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('serial_number', sa.String(255), nullable=False),
        sa.Column('fingerprint', sa.String(255), nullable=False),
        sa.Column('issuer', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('algorithm', sa.String(50), nullable=False),
        sa.Column('key_size', sa.String(20), nullable=False),
        sa.Column('created', sa.String(10), nullable=False),
        sa.Column('expires', sa.String(10), nullable=False),
        sa.Column('usage', sa.String(50), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('partner', sa.String(120), nullable=False),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'transactions',
        sa.Column('id', sa.String(80), primary_key=True),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('doc_type', sa.String(20), nullable=True),
        sa.Column('type_name', sa.String(120), nullable=False),
        sa.Column('partner', sa.String(120), nullable=False),
        sa.Column('direction', sa.String(16), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('date', sa.String(10), nullable=False),
        sa.Column('time', sa.String(8), nullable=False),
        sa.Column('size', sa.String(20), nullable=False),
        sa.Column('records', sa.Integer(), nullable=False),
        sa.Column('control_number', sa.String(50), nullable=False),
        sa.Column('sender_id', sa.String(50), nullable=False),
        sa.Column('receiver_id', sa.String(50), nullable=False),
        sa.Column('source_system', sa.String(20), nullable=False),
        sa.Column('external_event_id', sa.String(120), nullable=True),
        sa.Column('idempotency_key', sa.String(120), nullable=True),
        sa.Column('business_refs', sa.JSON(), nullable=False),
        sa.Column('control_refs', sa.JSON(), nullable=False),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.Column('raw', sa.Text(), nullable=False),
        sa.Column('logs', sa.JSON(), nullable=False),
        sa.Column('errors', sa.JSON(), nullable=True),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_transactions_idempotency_key', 'transactions', ['idempotency_key'], unique=True)
    op.create_index('ix_transactions_external_event_id', 'transactions', ['external_event_id'])
    op.create_index('ix_transactions_source_system', 'transactions', ['source_system'])
    op.create_index('ix_transactions_doc_type', 'transactions', ['doc_type'])
    op.create_index('ix_transactions_occurred_at', 'transactions', ['occurred_at'])

    op.create_table(
        'transaction_links',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('from_transaction_id', sa.String(80), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('to_transaction_id', sa.String(80), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('relation_type', sa.String(20), nullable=False),
        sa.Column('match_rule', sa.String(120), nullable=False),
        sa.Column('confidence', sa.Integer(), nullable=False),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_transaction_links_from_transaction_id', 'transaction_links', ['from_transaction_id'])
    op.create_index('ix_transaction_links_to_transaction_id', 'transaction_links', ['to_transaction_id'])
    op.create_index('ix_transaction_links_relation_type', 'transaction_links', ['relation_type'])

    op.create_table(
        'integration_clients',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('api_key_hash', sa.String(128), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('allowed_sources', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_integration_clients_api_key_hash', 'integration_clients', ['api_key_hash'], unique=True)

    op.create_table(
        'api_clients',
        sa.Column('client_id', sa.String(80), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('secret_hash', sa.String(255), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'oauth_tokens',
        sa.Column('jti', sa.String(80), primary_key=True),
        sa.Column('client_id', sa.String(80), sa.ForeignKey('api_clients.client_id', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_oauth_tokens_client_id', 'oauth_tokens', ['client_id'])
    op.create_index('ix_oauth_tokens_expires_at', 'oauth_tokens', ['expires_at'])
    op.create_index('ix_oauth_tokens_revoked', 'oauth_tokens', ['revoked'])

    op.create_table(
        'api_call_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('trace_id', sa.String(64), nullable=False),
        sa.Column('client_id', sa.String(80), nullable=True),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('path', sa.String(255), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_call_logs_trace_id', 'api_call_logs', ['trace_id'])
    op.create_index('ix_api_call_logs_client_id', 'api_call_logs', ['client_id'])
    op.create_index('ix_api_call_logs_path', 'api_call_logs', ['path'])
    op.create_index('ix_api_call_logs_status_code', 'api_call_logs', ['status_code'])
    op.create_index('ix_api_call_logs_created_at', 'api_call_logs', ['created_at'])

    op.create_table(
        'api_quotas',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('client_id', sa.String(80), nullable=False),
        sa.Column('period', sa.String(10), nullable=False),
        sa.Column('period_key', sa.String(20), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('client_id', 'period', 'period_key', name='uq_api_quota_period'),
    )
    op.create_index('ix_api_quotas_client_id', 'api_quotas', ['client_id'])
    op.create_index('ix_api_quotas_period', 'api_quotas', ['period'])
    op.create_index('ix_api_quotas_period_key', 'api_quotas', ['period_key'])

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('type', sa.String(16), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('date', sa.String(10), nullable=False),
        sa.Column('time', sa.String(8), nullable=False),
        sa.Column('read', sa.Boolean(), nullable=False),
        sa.Column('archived', sa.Boolean(), nullable=False),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('action', sa.JSON(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'unis_specifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(10), nullable=False, unique=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(80), nullable=False),
        sa.Column('version', sa.String(30), nullable=False),
        sa.Column('last_updated', sa.String(10), nullable=False),
    )

    op.create_table(
        'tp_specifications',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('message_type', sa.String(20), nullable=False),
        sa.Column('message_name', sa.String(120), nullable=False),
        sa.Column('partner', sa.String(120), nullable=False),
        sa.Column('partner_code', sa.String(30), nullable=False),
        sa.Column('version', sa.String(30), nullable=False),
        sa.Column('uploaded_date', sa.String(10), nullable=False),
        sa.Column('uploaded_by', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(20), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('size', sa.String(20), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('partner', 'message_type', 'version', 'file_name', name='uq_tp_spec_history'),
    )


def downgrade() -> None:
    op.drop_index('ix_api_quotas_period_key', table_name='api_quotas')
    op.drop_index('ix_api_quotas_period', table_name='api_quotas')
    op.drop_index('ix_api_quotas_client_id', table_name='api_quotas')
    op.drop_table('api_quotas')
    op.drop_index('ix_api_call_logs_created_at', table_name='api_call_logs')
    op.drop_index('ix_api_call_logs_status_code', table_name='api_call_logs')
    op.drop_index('ix_api_call_logs_path', table_name='api_call_logs')
    op.drop_index('ix_api_call_logs_client_id', table_name='api_call_logs')
    op.drop_index('ix_api_call_logs_trace_id', table_name='api_call_logs')
    op.drop_table('api_call_logs')
    op.drop_index('ix_oauth_tokens_revoked', table_name='oauth_tokens')
    op.drop_index('ix_oauth_tokens_expires_at', table_name='oauth_tokens')
    op.drop_index('ix_oauth_tokens_client_id', table_name='oauth_tokens')
    op.drop_table('oauth_tokens')
    op.drop_table('api_clients')
    op.drop_index('ix_integration_clients_api_key_hash', table_name='integration_clients')
    op.drop_table('integration_clients')
    op.drop_index('ix_transaction_links_relation_type', table_name='transaction_links')
    op.drop_index('ix_transaction_links_to_transaction_id', table_name='transaction_links')
    op.drop_index('ix_transaction_links_from_transaction_id', table_name='transaction_links')
    op.drop_table('transaction_links')
    op.drop_index('ix_transactions_occurred_at', table_name='transactions')
    op.drop_index('ix_transactions_doc_type', table_name='transactions')
    op.drop_index('ix_transactions_source_system', table_name='transactions')
    op.drop_index('ix_transactions_external_event_id', table_name='transactions')
    op.drop_index('ix_transactions_idempotency_key', table_name='transactions')
    op.drop_table('tp_specifications')
    op.drop_table('unis_specifications')
    op.drop_table('notifications')
    op.drop_table('transactions')
    op.drop_table('certificates')
    op.drop_table('as2_profiles')
    op.drop_table('subsidiaries')
    op.drop_table('partners')
    op.drop_table('email_verification_tokens')
    op.drop_table('sessions')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
