from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.transaction import Transaction
from app.services.price_analyzer import build_price_verdict

router = APIRouter()


@router.get("/price-check")
async def price_check(
    community_id: int,
    total_price: float = Query(gt=0),
    area: float = Query(gt=0),
    db: AsyncSession = Depends(get_db),
):
    unit_price = (total_price * 10000) / area
    min_area, max_area = area * 0.8, area * 1.2

    stmt = select(Transaction).where(
        and_(
            Transaction.community_id == community_id,
            Transaction.area >= min_area,
            Transaction.area <= max_area,
            Transaction.deal_unit_price.is_not(None),
        )
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="缺少可用于评估的成交记录")

    prices = [float(item.deal_unit_price) for item in rows if item.deal_unit_price is not None]
    verdict = build_price_verdict(input_unit_price=unit_price, history_prices=prices)

    similar = sorted(
        rows,
        key=lambda item: abs((float(item.deal_unit_price) if item.deal_unit_price else 0) - unit_price),
    )[:3]

    return {
        "input_unit_price": unit_price,
        "avg_deal_unit_price": sum(prices) / len(prices),
        "percentile": verdict["percentile"],
        "verdict": verdict["verdict"],
        "similar_deals": [
            {
                "deal_unit_price": float(item.deal_unit_price) if item.deal_unit_price is not None else None,
                "deal_price": float(item.deal_price) if item.deal_price is not None else None,
                "area": float(item.area) if item.area is not None else None,
                "deal_date": item.deal_date.isoformat() if item.deal_date else None,
            }
            for item in similar
        ],
    }


@router.get("/compare")
async def compare_analysis():
    return {
        "detail": "compare 分析接口待接入更多业务规则",
    }
