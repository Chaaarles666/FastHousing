from pydantic import BaseModel


class ListingItem(BaseModel):
    id: int
    title: str | None = None
    total_price: float | None = None
    unit_price: float | None = None
    area: float | None = None
    layout: str | None = None
    floor_info: str | None = None
    orientation: str | None = None
    decoration: str | None = None
    build_year: int | None = None


class ListingDetail(ListingItem):
    community_id: int | None = None
    status: str | None = None
    source_url: str | None = None
