from fastapi import APIRouter, HTTPException, status

from app.api.deps import AdminOnly, CurrentUser, Session
from app.core.config import get_settings as get_app_settings
from app.notifications import messages
from app.notifications.telegram import TelegramError, TelegramNotConfiguredError, send_message
from app.schemas.settings import (
    ShopSettings,
    ShopSettingsOut,
    ShopSettingsUpdate,
    TelegramTestRequest,
)
from app.services import settings as svc

router = APIRouter(prefix="/settings", tags=["admin: settings"])


def _out(data: ShopSettings) -> ShopSettingsOut:
    return ShopSettingsOut(
        **data.model_dump(), telegram_bot_configured=bool(get_app_settings().telegram_bot_token)
    )


@router.get("")
async def get_settings(session: Session, _: CurrentUser) -> ShopSettingsOut:
    """Readable by operators too — they need the payment details."""
    return _out(await svc.get_settings(session))


@router.patch("")
async def update_settings(
    body: ShopSettingsUpdate, session: Session, _: AdminOnly
) -> ShopSettingsOut:
    return _out(await svc.update_settings(session, body))


@router.post("/telegram/test", status_code=status.HTTP_204_NO_CONTENT)
async def telegram_test(body: TelegramTestRequest, session: Session, _: AdminOnly) -> None:
    """Sends a test message to the given (or saved) chat."""
    chat_id = body.chat_id or (await svc.get_settings(session)).telegram_chat_id
    try:
        await send_message(chat_id, messages.test_message())
    except TelegramNotConfiguredError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except TelegramError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
