from pydantic import BaseModel


class TransactionItem(BaseModel):
    id: int
    community_id: int | None = None
    deal_price: float | None = None
    deal_unit_price: float | None = None
    listing_price: float | None = None
    price_diff: float | None = None
    deal_date: str | None = None
    deal_cycle: int | None = None
    area: float | None = None
    layout: str | None = None
