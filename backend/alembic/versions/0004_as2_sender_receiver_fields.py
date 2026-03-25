"""as2 sender receiver fields

Revision ID: 0004_as2_sender_receiver_fields
Revises: 0003_api_client_owner
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa

revision = '0004_as2_sender_receiver_fields'
down_revision = '0003_api_client_owner'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('as2_profiles', sa.Column('as2_port', sa.Integer(), nullable=True))
    op.add_column('as2_profiles', sa.Column('sender_id', sa.String(length=64), nullable=True))
    op.add_column('as2_profiles', sa.Column('sender_qualifier', sa.String(length=8), nullable=True))
    op.add_column('as2_profiles', sa.Column('receiver_id', sa.String(length=64), nullable=True))
    op.add_column('as2_profiles', sa.Column('receiver_qualifier', sa.String(length=8), nullable=True))
    op.execute("UPDATE as2_profiles SET as2_port=443 WHERE as2_port IS NULL")
    op.execute("UPDATE as2_profiles SET sender_id='' WHERE sender_id IS NULL")
    op.execute("UPDATE as2_profiles SET sender_qualifier='ZZ' WHERE sender_qualifier IS NULL")
    op.execute("UPDATE as2_profiles SET receiver_id='' WHERE receiver_id IS NULL")
    op.execute("UPDATE as2_profiles SET receiver_qualifier='ZZ' WHERE receiver_qualifier IS NULL")


def downgrade() -> None:
    op.drop_column('as2_profiles', 'receiver_qualifier')
    op.drop_column('as2_profiles', 'receiver_id')
    op.drop_column('as2_profiles', 'sender_qualifier')
    op.drop_column('as2_profiles', 'sender_id')
    op.drop_column('as2_profiles', 'as2_port')
