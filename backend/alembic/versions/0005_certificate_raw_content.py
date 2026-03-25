"""certificate raw content

Revision ID: 0005_certificate_raw_content
Revises: 0004_as2_sender_receiver_fields
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa

revision = '0005_certificate_raw_content'
down_revision = '0004_as2_sender_receiver_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('certificates', sa.Column('raw_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('certificates', 'raw_content')
