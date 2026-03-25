"""api client owner support

Revision ID: 0003_api_client_owner
Revises: 0002_full_alignment
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa

revision = '0003_api_client_owner'
down_revision = '0002_full_alignment'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('api_clients', sa.Column('owner_user_id', sa.String(length=64), nullable=True))
    op.create_index('ix_api_clients_owner_user_id', 'api_clients', ['owner_user_id'])
    op.create_foreign_key(
        'fk_api_clients_owner_user_id_users',
        'api_clients',
        'users',
        ['owner_user_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_api_clients_owner_user_id_users', 'api_clients', type_='foreignkey')
    op.drop_index('ix_api_clients_owner_user_id', table_name='api_clients')
    op.drop_column('api_clients', 'owner_user_id')
