from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (UniqueConstraint("community_id", "record_date", name="uq_community_record_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    community_id: Mapped[int] = mapped_column(ForeignKey("communities.id"), index=True)
    record_date: Mapped[str] = mapped_column(Date, index=True)
    avg_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    listing_count: Mapped[int | None] = mapped_column(Integer)
    deal_count: Mapped[int | None] = mapped_column(Integer)
    avg_deal_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
