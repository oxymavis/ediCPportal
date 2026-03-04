"""full alignment additions

Revision ID: 0002_full_alignment
Revises: 0001_initial
Create Date: 2026-03-04
"""

from alembic import op
import sqlalchemy as sa

revision = '0002_full_alignment'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_algo', sa.String(length=16), nullable=True))
    op.execute("UPDATE users SET password_algo='pbkdf2' WHERE password_algo IS NULL")

    op.add_column('partners', sa.Column('integration_type', sa.String(length=16), nullable=True))
    op.add_column('partners', sa.Column('communication_channel', sa.String(length=20), nullable=True))
    op.add_column('partners', sa.Column('current_step_id', sa.Integer(), nullable=True))
    op.add_column('partners', sa.Column('onboarding_start_date', sa.String(length=10), nullable=True))
    op.add_column('partners', sa.Column('step_completion_dates', sa.JSON(), nullable=True))
    op.add_column('partners', sa.Column('api_config', sa.JSON(), nullable=True))
    op.execute("UPDATE partners SET integration_type='edi' WHERE integration_type IS NULL")
    op.execute("UPDATE partners SET current_step_id=1 WHERE current_step_id IS NULL")
    op.create_index('ix_partners_integration_type', 'partners', ['integration_type'])
    op.create_index('ix_partners_communication_channel', 'partners', ['communication_channel'])
    op.create_index('ix_partners_current_step_id', 'partners', ['current_step_id'])

    op.add_column('transactions', sa.Column('integration_type', sa.String(length=16), nullable=True))
    op.add_column('transactions', sa.Column('channel', sa.String(length=20), nullable=True))
    op.create_index('ix_transactions_integration_type', 'transactions', ['integration_type'])
    op.create_index('ix_transactions_channel', 'transactions', ['channel'])

    op.create_table(
        'api_messages',
        sa.Column('code', sa.String(20), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('category', sa.String(80), nullable=False),
        sa.Column('x12_equivalent', sa.String(20), nullable=True),
        sa.Column('version', sa.String(30), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_messages_category', 'api_messages', ['category'])

    op.create_table(
        'api_message_schemas',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('message_code', sa.String(20), sa.ForeignKey('api_messages.code', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.String(30), nullable=False),
        sa.Column('schema', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_message_schemas_message_code', 'api_message_schemas', ['message_code'])

    op.create_table(
        'api_message_samples',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('message_code', sa.String(20), sa.ForeignKey('api_messages.code', ondelete='CASCADE'), nullable=False),
        sa.Column('sample_type', sa.String(16), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_message_samples_message_code', 'api_message_samples', ['message_code'])
    op.create_index('ix_api_message_samples_sample_type', 'api_message_samples', ['sample_type'])

    op.create_table(
        'api_message_mappings',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('message_code', sa.String(20), sa.ForeignKey('api_messages.code', ondelete='CASCADE'), nullable=False),
        sa.Column('json_field', sa.String(255), nullable=False),
        sa.Column('x12_segment', sa.String(50), nullable=False),
        sa.Column('x12_element', sa.String(50), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_message_mappings_message_code', 'api_message_mappings', ['message_code'])

    op.create_table(
        'connection_test_runs',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('partner_id', sa.String(64), nullable=True),
        sa.Column('test_type', sa.String(16), nullable=False),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('summary', sa.JSON(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('trace_id', sa.String(64), nullable=True),
    )
    op.create_index('ix_connection_test_runs_partner_id', 'connection_test_runs', ['partner_id'])
    op.create_index('ix_connection_test_runs_test_type', 'connection_test_runs', ['test_type'])
    op.create_index('ix_connection_test_runs_environment', 'connection_test_runs', ['environment'])
    op.create_index('ix_connection_test_runs_status', 'connection_test_runs', ['status'])

    op.create_table(
        'connection_test_steps',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('run_id', sa.String(64), sa.ForeignKey('connection_test_runs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_no', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('latency_ms', sa.Integer(), nullable=False),
        sa.Column('detail', sa.String(500), nullable=True),
        sa.Column('evidence', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_connection_test_steps_run_id', 'connection_test_steps', ['run_id'])

    op.create_table(
        'document_test_reports',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('partner_id', sa.String(64), nullable=True),
        sa.Column('environment', sa.String(20), nullable=False),
        sa.Column('message_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('errors', sa.JSON(), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_document_test_reports_partner_id', 'document_test_reports', ['partner_id'])
    op.create_index('ix_document_test_reports_environment', 'document_test_reports', ['environment'])
    op.create_index('ix_document_test_reports_message_type', 'document_test_reports', ['message_type'])
    op.create_index('ix_document_test_reports_status', 'document_test_reports', ['status'])

    op.create_table(
        'validator_reports',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('format', sa.String(16), nullable=False),
        sa.Column('valid', sa.Boolean(), nullable=False),
        sa.Column('errors', sa.JSON(), nullable=False),
        sa.Column('warnings', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_validator_reports_format', 'validator_reports', ['format'])


def downgrade() -> None:
    op.drop_index('ix_validator_reports_format', table_name='validator_reports')
    op.drop_table('validator_reports')

    op.drop_index('ix_document_test_reports_status', table_name='document_test_reports')
    op.drop_index('ix_document_test_reports_message_type', table_name='document_test_reports')
    op.drop_index('ix_document_test_reports_environment', table_name='document_test_reports')
    op.drop_index('ix_document_test_reports_partner_id', table_name='document_test_reports')
    op.drop_table('document_test_reports')

    op.drop_index('ix_connection_test_steps_run_id', table_name='connection_test_steps')
    op.drop_table('connection_test_steps')

    op.drop_index('ix_connection_test_runs_status', table_name='connection_test_runs')
    op.drop_index('ix_connection_test_runs_environment', table_name='connection_test_runs')
    op.drop_index('ix_connection_test_runs_test_type', table_name='connection_test_runs')
    op.drop_index('ix_connection_test_runs_partner_id', table_name='connection_test_runs')
    op.drop_table('connection_test_runs')

    op.drop_index('ix_api_message_mappings_message_code', table_name='api_message_mappings')
    op.drop_table('api_message_mappings')

    op.drop_index('ix_api_message_samples_sample_type', table_name='api_message_samples')
    op.drop_index('ix_api_message_samples_message_code', table_name='api_message_samples')
    op.drop_table('api_message_samples')

    op.drop_index('ix_api_message_schemas_message_code', table_name='api_message_schemas')
    op.drop_table('api_message_schemas')

    op.drop_index('ix_api_messages_category', table_name='api_messages')
    op.drop_table('api_messages')

    op.drop_index('ix_transactions_channel', table_name='transactions')
    op.drop_index('ix_transactions_integration_type', table_name='transactions')
    op.drop_column('transactions', 'channel')
    op.drop_column('transactions', 'integration_type')

    op.drop_index('ix_partners_current_step_id', table_name='partners')
    op.drop_index('ix_partners_communication_channel', table_name='partners')
    op.drop_index('ix_partners_integration_type', table_name='partners')
    op.drop_column('partners', 'api_config')
    op.drop_column('partners', 'step_completion_dates')
    op.drop_column('partners', 'onboarding_start_date')
    op.drop_column('partners', 'current_step_id')
    op.drop_column('partners', 'communication_channel')
    op.drop_column('partners', 'integration_type')

    op.drop_column('users', 'password_algo')
