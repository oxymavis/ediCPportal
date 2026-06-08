"""transaction system events

Revision ID: 0006_transaction_system_events
Revises: 0005_certificate_raw_content
Create Date: 2026-06-08
"""

from alembic import op
import sqlalchemy as sa

revision = '0006_transaction_system_events'
down_revision = '0005_certificate_raw_content'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('transactions', sa.Column('payload_format', sa.String(20), nullable=False, server_default='text'))
    op.add_column('transactions', sa.Column('raw_payload', sa.JSON(), nullable=False, server_default='{}'))

    op.create_table(
        'transaction_system_events',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('transaction_id', sa.String(80), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('idempotency_key', sa.String(120), nullable=False),
        sa.Column('system', sa.String(80), nullable=False),
        sa.Column('stage', sa.String(120), nullable=False),
        sa.Column('event_type', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('external_status', sa.String(80), nullable=False),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.Column('message', sa.String(1000), nullable=True),
        sa.Column('input_format', sa.String(20), nullable=True),
        sa.Column('input_data', sa.JSON(), nullable=True),
        sa.Column('output_format', sa.String(20), nullable=True),
        sa.Column('output_data', sa.JSON(), nullable=True),
        sa.Column('errors', sa.JSON(), nullable=False),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('trace_id', sa.String(120), nullable=True),
        sa.Column('attempt_no', sa.Integer(), nullable=False),
        sa.Column('is_final', sa.Boolean(), nullable=False),
        sa.Column('event_metadata', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('transaction_id', 'idempotency_key', name='uq_transaction_system_event_idempotency'),
    )
    op.create_index('ix_transaction_system_events_transaction_id', 'transaction_system_events', ['transaction_id'])
    op.create_index('ix_transaction_system_events_idempotency_key', 'transaction_system_events', ['idempotency_key'])
    op.create_index('ix_transaction_system_events_system', 'transaction_system_events', ['system'])
    op.create_index('ix_transaction_system_events_stage', 'transaction_system_events', ['stage'])
    op.create_index('ix_transaction_system_events_event_type', 'transaction_system_events', ['event_type'])
    op.create_index('ix_transaction_system_events_status', 'transaction_system_events', ['status'])
    op.create_index('ix_transaction_system_events_occurred_at', 'transaction_system_events', ['occurred_at'])
    op.create_index('ix_transaction_system_events_trace_id', 'transaction_system_events', ['trace_id'])


def downgrade() -> None:
    op.drop_index('ix_transaction_system_events_trace_id', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_occurred_at', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_status', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_event_type', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_stage', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_system', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_idempotency_key', table_name='transaction_system_events')
    op.drop_index('ix_transaction_system_events_transaction_id', table_name='transaction_system_events')
    op.drop_table('transaction_system_events')
    op.drop_column('transactions', 'raw_payload')
    op.drop_column('transactions', 'payload_format')
