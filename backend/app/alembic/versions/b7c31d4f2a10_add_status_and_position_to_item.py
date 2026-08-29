"""Add status and position to Item

Drops and recreates the item table with the new columns. No data is preserved.

Revision ID: b7c31d4f2a10
Revises: fe56fa70289e
Create Date: 2026-08-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'b7c31d4f2a10'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


item_status = sa.Enum('todo', 'in_progress', 'completed', name='itemstatus')


def upgrade():
    op.drop_table('item')
    # the itemstatus type is created implicitly with the table
    op.create_table(
        'item',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', item_status, nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_item_status'), 'item', ['status'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_item_status'), table_name='item')
    op.drop_table('item')
    item_status.drop(op.get_bind(), checkfirst=True)
    op.create_table(
        'item',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
