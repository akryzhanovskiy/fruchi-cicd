from fastapi import APIRouter

from app.api import catalog, orders, seo
from app.api.admin import admin_router
from app.core.config import get_settings
from app.services import health

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(catalog.router)
api_router.include_router(orders.router)
api_router.include_router(seo.router)
api_router.include_router(admin_router)


@api_router.get("/status", tags=["health"])
async def api_status() -> dict[str, object]:
    """Same checks as /readyz, reachable through the frontends' /api proxy."""
    return {"environment": get_settings().environment, "checks": await health.readiness()}
