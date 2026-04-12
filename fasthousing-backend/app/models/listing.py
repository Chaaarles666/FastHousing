from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    beike_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    community_id: Mapped[int | None] = mapped_column(ForeignKey("communities.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(300))
    total_price: Mapped[float | None] = mapped_column(Numeric(10, 2), index=True)
    unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    area: Mapped[float | None] = mapped_column(Numeric(8, 2), index=True)
    layout: Mapped[str | None] = mapped_column(String(50))
    layout_rooms: Mapped[int | None] = mapped_column(Integer)
    layout_halls: Mapped[int | None] = mapped_column(Integer)
    floor_info: Mapped[str | None] = mapped_column(String(100))
    floor_number: Mapped[int | None] = mapped_column(Integer)
    total_floors: Mapped[int | None] = mapped_column(Integer)
    orientation: Mapped[str | None] = mapped_column(String(50))
    decoration: Mapped[str | None] = mapped_column(String(50))
    build_year: Mapped[int | None] = mapped_column(Integer)
    elevator: Mapped[bool | None] = mapped_column(Boolean)
    listing_date: Mapped[str | None] = mapped_column(Date)
    last_price_change: Mapped[float | None] = mapped_column(Numeric(10, 2))
    price_change_date: Mapped[str | None] = mapped_column(Date)
    is_unique: Mapped[bool | None] = mapped_column(Boolean)
    is_full_five: Mapped[bool | None] = mapped_column(Boolean)
    has_mortgage: Mapped[bool | None] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    images: Mapped[dict | None] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(20), default="beike")
    source_url: Mapped[str | None] = mapped_column(String(500))
    raw_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
