from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    beike_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    community_id: Mapped[int | None] = mapped_column(ForeignKey("communities.id"), index=True)
    listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id"), index=True)
    deal_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    deal_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2), index=True)
    listing_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    price_diff: Mapped[float | None] = mapped_column(Numeric(10, 2))
    deal_date: Mapped[str | None] = mapped_column(Date, index=True)
    deal_cycle: Mapped[int | None] = mapped_column(Integer)
    area: Mapped[float | None] = mapped_column(Numeric(8, 2))
    layout: Mapped[str | None] = mapped_column(String(50))
    floor_info: Mapped[str | None] = mapped_column(String(100))
    orientation: Mapped[str | None] = mapped_column(String(50))
    decoration: Mapped[str | None] = mapped_column(String(50))
    build_year: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20), default="beike")
    source_url: Mapped[str | None] = mapped_column(String(500))
    raw_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
