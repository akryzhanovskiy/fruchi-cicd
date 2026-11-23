"""Minimal Telegram Bot API client: we only send messages to the operators' chat."""

from typing import Any

import httpx

from app.core.config import get_settings


class TelegramError(Exception):
    """Delivery failed. `retryable` is false for errors a retry can't fix (bad token, chat)."""

    def __init__(self, message: str, *, retryable: bool, retry_after: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.retry_after = retry_after


class TelegramNotConfiguredError(Exception):
    pass


async def send_message(chat_id: str, text: str, *, client: httpx.AsyncClient | None = None) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        raise TelegramNotConfiguredError("Не задано TELEGRAM_BOT_TOKEN")
    if not chat_id:
        raise TelegramNotConfiguredError("Не задано Telegram chat ID у налаштуваннях")

    url = f"{settings.telegram_api_url}/bot{settings.telegram_bot_token}/sendMessage"
    body = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "link_preview_options": {"is_disabled": True},
    }
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=15) as own:
                response = await own.post(url, json=body)
        else:
            response = await client.post(url, json=body)
    except httpx.HTTPError as exc:
        # Never include the URL: it contains the bot token.
        raise TelegramError(f"Telegram недоступний: {type(exc).__name__}", retryable=True) from None

    if response.status_code == 200:
        return
    try:
        data: dict[str, Any] = response.json()
    except ValueError:
        data = {}
    description = str(data.get("description") or f"HTTP {response.status_code}")
    retry_after = (data.get("parameters") or {}).get("retry_after")
    # 429 (flood control) and 5xx are temporary; 400/401/403 mean a bad token, chat id or
    # the bot was blocked — retrying won't help until someone fixes the settings.
    retryable = response.status_code == 429 or response.status_code >= 500
    raise TelegramError(
        f"Telegram: {description}",
        retryable=retryable,
        retry_after=int(retry_after) if retry_after else None,
    )
