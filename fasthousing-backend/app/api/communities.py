from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.community import Community
from app.models.price_history import PriceHistory

router = APIRouter()


@router.get("")
async def get_communities(
    district: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    has_metro: bool | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if district:
        filters.append(Community.district == district)
    if min_price is not None:
        filters.append(Community.avg_unit_price >= min_price)
    if max_price is not None:
        filters.append(Community.avg_unit_price <= max_price)
    if has_metro:
        filters.append(Community.nearby_metro.is_not(None))

    stmt = select(Community).offset((page - 1) * size).limit(size)
    if filters:
        stmt = stmt.where(and_(*filters))

    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": item.id,
                "name": item.name,
                "district": item.district,
                "sub_district": item.sub_district,
                "avg_unit_price": float(item.avg_unit_price) if item.avg_unit_price is not None else None,
                "listing_count": item.listing_count,
                "build_year": item.build_year,
            }
            for item in items
        ],
        "page": page,
        "size": size,
    }


@router.get("/search")
async def search_communities(
    q: str = Query(min_length=1, max_length=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Community).where(Community.name.ilike(f"%{q}%")).limit(20)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return [
        {
            "id": item.id,
            "name": item.name,
            "district": item.district,
            "sub_district": item.sub_district,
            "avg_unit_price": float(item.avg_unit_price) if item.avg_unit_price is not None else None,
            "listing_count": item.listing_count,
            "build_year": item.build_year,
        }
        for item in items
    ]


@router.get("/{community_id}")
async def get_community(community_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Community).where(Community.id == community_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="小区不存在")

    return {
        "id": item.id,
        "name": item.name,
        "district": item.district,
        "sub_district": item.sub_district,
        "avg_unit_price": float(item.avg_unit_price) if item.avg_unit_price is not None else None,
        "listing_count": item.listing_count,
        "build_year": item.build_year,
        "address": item.address,
        "property_fee": float(item.property_fee) if item.property_fee is not None else None,
        "nearby_metro": item.nearby_metro,
        "nearby_schools": item.nearby_schools,
    }


@router.get("/{community_id}/price-history")
async def get_community_price_history(
    community_id: int,
    months: int = Query(default=12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PriceHistory)
        .where(PriceHistory.community_id == community_id)
        .order_by(PriceHistory.record_date.desc())
        .limit(months)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    rows.reverse()

    return [
        {
            "date": row.record_date.isoformat() if row.record_date else "",
            "avg_unit_price": float(row.avg_unit_price) if row.avg_unit_price is not None else 0,
            "listing_count": row.listing_count,
            "deal_count": row.deal_count,
        }
        for row in rows
    ]
