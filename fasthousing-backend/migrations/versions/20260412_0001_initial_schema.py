"""Initial schema for communities/listings/transactions/price_history.

Revision ID: 20260412_0001
Revises:
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260412_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "communities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("beike_id", sa.String(length=32), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("city", sa.String(length=20), nullable=False, server_default="上海"),
        sa.Column("district", sa.String(length=50), nullable=True),
        sa.Column("sub_district", sa.String(length=50), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("build_year", sa.Integer(), nullable=True),
        sa.Column("building_type", sa.String(length=50), nullable=True),
        sa.Column("total_units", sa.Integer(), nullable=True),
        sa.Column("property_fee", sa.Numeric(6, 2), nullable=True),
        sa.Column("property_company", sa.String(length=200), nullable=True),
        sa.Column("developer", sa.String(length=200), nullable=True),
        sa.Column("green_rate", sa.Numeric(4, 2), nullable=True),
        sa.Column("parking_ratio", sa.String(length=50), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("nearby_metro", sa.JSON(), nullable=True),
        sa.Column("nearby_schools", sa.JSON(), nullable=True),
        sa.Column("avg_unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("listing_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="beike"),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("beike_id"),
    )
    op.create_index("ix_communities_name", "communities", ["name"])
    op.create_index("ix_communities_district", "communities", ["district"])
    op.create_index("ix_communities_avg_unit_price", "communities", ["avg_unit_price"])

    op.create_table(
        "listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("beike_id", sa.String(length=32), nullable=True),
        sa.Column("community_id", sa.Integer(), sa.ForeignKey("communities.id"), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("area", sa.Numeric(8, 2), nullable=True),
        sa.Column("layout", sa.String(length=50), nullable=True),
        sa.Column("layout_rooms", sa.Integer(), nullable=True),
        sa.Column("layout_halls", sa.Integer(), nullable=True),
        sa.Column("floor_info", sa.String(length=100), nullable=True),
        sa.Column("floor_number", sa.Integer(), nullable=True),
        sa.Column("total_floors", sa.Integer(), nullable=True),
        sa.Column("orientation", sa.String(length=50), nullable=True),
        sa.Column("decoration", sa.String(length=50), nullable=True),
        sa.Column("build_year", sa.Integer(), nullable=True),
        sa.Column("elevator", sa.Boolean(), nullable=True),
        sa.Column("listing_date", sa.Date(), nullable=True),
        sa.Column("last_price_change", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_change_date", sa.Date(), nullable=True),
        sa.Column("is_unique", sa.Boolean(), nullable=True),
        sa.Column("is_full_five", sa.Boolean(), nullable=True),
        sa.Column("has_mortgage", sa.Boolean(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("images", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="beike"),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("beike_id"),
    )
    op.create_index("ix_listings_community_id", "listings", ["community_id"])
    op.create_index("ix_listings_status", "listings", ["status"])

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("beike_id", sa.String(length=32), nullable=True),
        sa.Column("community_id", sa.Integer(), sa.ForeignKey("communities.id"), nullable=True),
        sa.Column("listing_id", sa.Integer(), sa.ForeignKey("listings.id"), nullable=True),
        sa.Column("deal_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("deal_unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("listing_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("price_diff", sa.Numeric(10, 2), nullable=True),
        sa.Column("deal_date", sa.Date(), nullable=True),
        sa.Column("deal_cycle", sa.Integer(), nullable=True),
        sa.Column("area", sa.Numeric(8, 2), nullable=True),
        sa.Column("layout", sa.String(length=50), nullable=True),
        sa.Column("floor_info", sa.String(length=100), nullable=True),
        sa.Column("orientation", sa.String(length=50), nullable=True),
        sa.Column("decoration", sa.String(length=50), nullable=True),
        sa.Column("build_year", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="beike"),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("beike_id"),
    )
    op.create_index("ix_transactions_community_id", "transactions", ["community_id"])
    op.create_index("ix_transactions_deal_date", "transactions", ["deal_date"])

    op.create_table(
        "price_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("community_id", sa.Integer(), sa.ForeignKey("communities.id"), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("avg_unit_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("listing_count", sa.Integer(), nullable=True),
        sa.Column("deal_count", sa.Integer(), nullable=True),
        sa.Column("avg_deal_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("community_id", "record_date", name="uq_community_record_date"),
    )
    op.create_index("ix_price_history_community_id", "price_history", ["community_id"])
    op.create_index("ix_price_history_record_date", "price_history", ["record_date"])


def downgrade() -> None:
    op.drop_table("price_history")
    op.drop_table("transactions")
    op.drop_table("listings")
    op.drop_table("communities")
