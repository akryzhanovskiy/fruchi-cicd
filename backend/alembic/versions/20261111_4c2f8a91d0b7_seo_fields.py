"""seo title and description for categories and products

Revision ID: 4c2f8a91d0b7
Revises: dd4382c55e6e
Create Date: 2026-11-11 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4c2f8a91d0b7"
down_revision: str | None = "dd4382c55e6e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("categories", "products")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table, sa.Column("seo_title", sa.String(200), nullable=False, server_default="")
        )
        op.add_column(
            table, sa.Column("seo_description", sa.String(400), nullable=False, server_default="")
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "seo_description")
        op.drop_column(table, "seo_title")
