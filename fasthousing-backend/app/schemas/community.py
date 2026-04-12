from pydantic import BaseModel


class CommunityBrief(BaseModel):
    id: int
    name: str
    district: str | None = None
    sub_district: str | None = None
    avg_unit_price: float | None = None
    listing_count: int | None = 0
    build_year: int | None = None


class CommunityDetail(CommunityBrief):
    address: str | None = None
    property_fee: float | None = None
    nearby_metro: dict | None = None
    nearby_schools: dict | None = None
