import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import AdminUser, UserRole

logger = logging.getLogger(__name__)


async def get_by_email(session: AsyncSession, email: str) -> AdminUser | None:
    return await session.scalar(
        select(AdminUser).where(func.lower(AdminUser.email) == email.lower())
    )


async def ensure_admin() -> None:
    """Creates the first admin from ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD.

    Does nothing if any user already exists — safe to run on every deploy (migration Job).
    """
    settings = get_settings()
    async with SessionLocal() as session:
        if await session.scalar(select(func.count()).select_from(AdminUser)):
            logger.info("Admin users exist, ensure-admin skipped")
            return
        if not settings.admin_initial_email or not settings.admin_initial_password:
            logger.warning("No admin users and ADMIN_INITIAL_EMAIL/PASSWORD not set")
            return
        session.add(
            AdminUser(
                email=settings.admin_initial_email.lower(),
                name="Адміністратор",
                password_hash=hash_password(settings.admin_initial_password),
                role=UserRole.ADMIN,
            )
        )
        await session.commit()
        logger.info("Created admin %s", settings.admin_initial_email)


async def set_password(email: str, password: str) -> bool:
    """Sets a user's password and signs them out everywhere. False if there is no such user."""
    async with SessionLocal() as session:
        user = await get_by_email(session, email)
        if user is None:
            return False
        user.password_hash = hash_password(password)
        user.token_version += 1
        await session.commit()
        return True
