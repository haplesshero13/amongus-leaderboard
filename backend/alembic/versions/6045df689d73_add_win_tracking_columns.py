"""add_win_tracking_columns

Revision ID: 6045df689d73
Revises: 
Create Date: 2026-01-29 14:51:05.249962

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6045df689d73'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add impostor_wins and crewmate_wins columns, drop previous_rank."""
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('model_ratings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('impostor_wins', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('crewmate_wins', sa.Integer(), nullable=False, server_default='0'))
        batch_op.drop_column('previous_rank')


def downgrade() -> None:
    """Remove win columns, restore previous_rank."""
    with op.batch_alter_table('model_ratings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('previous_rank', sa.Integer(), nullable=True))
        batch_op.drop_column('crewmate_wins')
        batch_op.drop_column('impostor_wins')
