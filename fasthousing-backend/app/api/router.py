from fastapi import APIRouter

from app.api.analysis import router as analysis_router
from app.api.communities import router as communities_router
from app.api.listings import router as listings_router
from app.api.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(communities_router, prefix="/communities", tags=["communities"])
api_router.include_router(listings_router, prefix="/listings", tags=["listings"])
api_router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
api_router.include_router(analysis_router, prefix="/analysis", tags=["analysis"])
