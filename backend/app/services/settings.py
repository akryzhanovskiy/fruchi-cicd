from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Setting
from app.schemas.settings import ShopSettings, ShopSettingsUpdate


async def get_settings(session: AsyncSession) -> ShopSettings:
    rows = await session.scalars(select(Setting).where(Setting.key.in_(ShopSettings.model_fields)))
    return ShopSettings.model_validate({row.key: row.value for row in rows})


async def update_settings(session: AsyncSession, data: ShopSettingsUpdate) -> ShopSettings:
    for key, value in data.model_dump(exclude_none=True).items():
        row = await session.get(Setting, key)
        if row is None:
            session.add(Setting(key=key, value=str(value)))
        else:
            row.value = str(value)
    await session.commit()
    return await get_settings(session)
