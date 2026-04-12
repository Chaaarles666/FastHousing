from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.listing import Listing

router = APIRouter()


@router.get("")
async def get_listings(
    community_id: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_area: float | None = None,
    max_area: float | None = None,
    rooms: int | None = None,
    status: str = "active",
    sort: str = "newest",
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = [Listing.status == status]
    if community_id:
        filters.append(Listing.community_id == community_id)
    if min_price is not None:
        filters.append(Listing.total_price >= min_price)
    if max_price is not None:
        filters.append(Listing.total_price <= max_price)
    if min_area is not None:
        filters.append(Listing.area >= min_area)
    if max_area is not None:
        filters.append(Listing.area <= max_area)
    if rooms is not None:
        filters.append(Listing.layout_rooms == rooms)

    stmt = select(Listing).where(and_(*filters))

    if sort == "price_asc":
        stmt = stmt.order_by(Listing.total_price.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Listing.total_price.desc())
    elif sort == "area_asc":
        stmt = stmt.order_by(Listing.area.asc())
    elif sort == "area_desc":
        stmt = stmt.order_by(Listing.area.desc())
    else:
        stmt = stmt.order_by(Listing.created_at.desc())

    stmt = stmt.offset((page - 1) * size).limit(size)

    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "total_price": float(item.total_price) if item.total_price is not None else None,
                "unit_price": float(item.unit_price) if item.unit_price is not None else None,
                "area": float(item.area) if item.area is not None else None,
                "layout": item.layout,
                "floor_info": item.floor_info,
                "orientation": item.orientation,
                "decoration": item.decoration,
                "build_year": item.build_year,
            }
            for item in items
        ],
        "page": page,
        "size": size,
    }


@router.get("/{listing_id}")
async def get_listing(listing_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Listing).where(Listing.id == listing_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="房源不存在")

    return {
        "id": item.id,
        "community_id": item.community_id,
        "title": item.title,
        "total_price": float(item.total_price) if item.total_price is not None else None,
        "unit_price": float(item.unit_price) if item.unit_price is not None else None,
        "area": float(item.area) if item.area is not None else None,
        "layout": item.layout,
        "floor_info": item.floor_info,
        "orientation": item.orientation,
        "decoration": item.decoration,
        "build_year": item.build_year,
        "status": item.status,
        "source_url": item.source_url,
    }
