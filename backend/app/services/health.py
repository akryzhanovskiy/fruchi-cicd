import httpx
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine


async def check_database() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return False
    return True


async def check_storage() -> bool:
    url = f"{get_settings().minio_endpoint.rstrip('/')}/minio/health/live"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(url)
    except httpx.HTTPError:
        return False
    return response.is_success


async def readiness() -> dict[str, bool]:
    return {"database": await check_database(), "storage": await check_storage()}
