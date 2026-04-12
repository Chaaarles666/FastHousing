from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.transaction import Transaction

router = APIRouter()


@router.get("")
async def get_transactions(
    community_id: int | None = None,
    months: int = Query(default=6, ge=1, le=36),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if community_id:
        filters.append(Transaction.community_id == community_id)

    start_date = date.today() - timedelta(days=30 * months)
    filters.append(Transaction.deal_date >= start_date)

    stmt = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.deal_date.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "items": [
            {
                "id": row.id,
                "community_id": row.community_id,
                "deal_price": float(row.deal_price) if row.deal_price is not None else None,
                "deal_unit_price": float(row.deal_unit_price) if row.deal_unit_price is not None else None,
                "listing_price": float(row.listing_price) if row.listing_price is not None else None,
                "price_diff": float(row.price_diff) if row.price_diff is not None else None,
                "deal_date": row.deal_date.isoformat() if row.deal_date else None,
                "deal_cycle": row.deal_cycle,
                "area": float(row.area) if row.area is not None else None,
                "layout": row.layout,
            }
            for row in rows
        ],
        "page": page,
        "size": size,
    }


@router.get("/stats")
async def get_transaction_stats(
    community_id: int,
    months: int = Query(default=12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
):
    start_date = date.today() - timedelta(days=30 * months)
    base_stmt = select(Transaction).where(
        Transaction.community_id == community_id,
        Transaction.deal_date >= start_date,
    )
    rows = (await db.execute(base_stmt)).scalars().all()

    if not rows:
        return {
            "avg_deal_price": None,
            "median_deal_price": None,
            "avg_price_diff": None,
            "avg_deal_cycle": None,
            "total_count": 0,
            "price_trend": [],
        }

    deal_prices = [float(item.deal_unit_price) for item in rows if item.deal_unit_price is not None]
    price_diffs = [float(item.price_diff) for item in rows if item.price_diff is not None]
    deal_cycles = [item.deal_cycle for item in rows if item.deal_cycle is not None]

    month_stmt = (
        select(
            func.to_char(Transaction.deal_date, "YYYY-MM").label("month"),
            func.avg(Transaction.deal_unit_price).label("avg_price"),
            func.count(Transaction.id).label("count"),
        )
        .where(Transaction.community_id == community_id, Transaction.deal_date >= start_date)
        .group_by(func.to_char(Transaction.deal_date, "YYYY-MM"))
        .order_by(func.to_char(Transaction.deal_date, "YYYY-MM"))
    )
    trend_rows = (await db.execute(month_stmt)).all()

    sorted_prices = sorted(deal_prices)
    mid = len(sorted_prices) // 2
    median = sorted_prices[mid] if len(sorted_prices) % 2 == 1 else (sorted_prices[mid - 1] + sorted_prices[mid]) / 2

    return {
        "avg_deal_price": sum(deal_prices) / len(deal_prices) if deal_prices else None,
        "median_deal_price": median if deal_prices else None,
        "avg_price_diff": sum(price_diffs) / len(price_diffs) if price_diffs else None,
        "avg_deal_cycle": sum(deal_cycles) / len(deal_cycles) if deal_cycles else None,
        "total_count": len(rows),
        "price_trend": [
            {
                "month": month,
                "avg_price": float(avg_price) if avg_price is not None else None,
                "count": int(count),
            }
            for month, avg_price, count in trend_rows
        ],
    }
