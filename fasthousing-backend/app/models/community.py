from sqlalchemy import JSON, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Community(Base):
    __tablename__ = "communities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    beike_id: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(20), default="上海")
    district: Mapped[str | None] = mapped_column(String(50), index=True)
    sub_district: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(String(300))
    build_year: Mapped[int | None] = mapped_column(Integer)
    building_type: Mapped[str | None] = mapped_column(String(50))
    total_units: Mapped[int | None] = mapped_column(Integer)
    property_fee: Mapped[float | None] = mapped_column(Numeric(6, 2))
    property_company: Mapped[str | None] = mapped_column(String(200))
    developer: Mapped[str | None] = mapped_column(String(200))
    green_rate: Mapped[float | None] = mapped_column(Numeric(4, 2))
    parking_ratio: Mapped[str | None] = mapped_column(String(50))
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7))
    nearby_metro: Mapped[dict | None] = mapped_column(JSON)
    nearby_schools: Mapped[dict | None] = mapped_column(JSON)
    avg_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 2), index=True)
    listing_count: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(20), default="beike")
    raw_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
