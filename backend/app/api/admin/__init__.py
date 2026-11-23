from fastapi import APIRouter

from app.api.admin import auth, catalog, dashboard, orders, settings, users

admin_router = APIRouter(prefix="/admin")
for module in (auth, catalog, dashboard, orders, settings, users):
    admin_router.include_router(module.router)
