"""Delivers `notification_outbox` rows to Telegram (run by the notifier worker)."""

import logging
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import NotificationOutbox, Order, OutboxStatus
from app.notifications import messages
from app.notifications.telegram import TelegramError, TelegramNotConfiguredError, send_message
from app.services.settings import get_settings as get_shop_settings

logger = logging.getLogger("worker.outbox")

BATCH_SIZE = 10
MAX_ATTEMPTS = 10
# Waiting for the bot token / chat id: re-check soon, without spending attempts.
NOT_CONFIGURED_DELAY = timedelta(minutes=1)


def backoff(attempts: int) -> timedelta:
    """30 s, 1, 2, 4 … minutes, at most an hour: 10 attempts span about 4 hours."""
    return timedelta(seconds=min(30 * 2 ** (attempts - 1), 3600))


class UnknownEventError(Exception):
    pass


async def render(session: AsyncSession, row: NotificationOutbox) -> str | None:
    """Message text, or None when there's nothing to send any more (e.g. order deleted)."""
    if row.event_type == "order_created":
        order = await session.scalar(
            select(Order)
            .where(Order.id == row.payload["order_id"])
            .options(selectinload(Order.items))
        )
        return messages.order_created(order) if order else None
    if row.event_type == "product_sold_out":
        return messages.product_sold_out(row.payload["product_id"], row.payload["name"])
    raise UnknownEventError(row.event_type)


async def process_batch(session: AsyncSession, http: httpx.AsyncClient | None = None) -> int:
    """Sends due rows; returns how many were handled. Safe to run in several workers:
    rows are locked with SKIP LOCKED, so each is picked by exactly one of them."""
    now = datetime.now(UTC)
    rows = list(
        await session.scalars(
            select(NotificationOutbox)
            .where(
                NotificationOutbox.status == OutboxStatus.PENDING,
                NotificationOutbox.next_attempt_at <= now,
            )
            .order_by(NotificationOutbox.id)
            .limit(BATCH_SIZE)
            .with_for_update(skip_locked=True)
        )
    )
    if not rows:
        return 0

    chat_id = (await get_shop_settings(session)).telegram_chat_id
    for row in rows:
        try:
            text = await render(session, row)
            if text is not None:
                await send_message(chat_id, text, client=http)
        except TelegramNotConfiguredError as exc:
            logger.warning("Notification %s postponed: %s", row.id, exc)
            row.next_attempt_at = now + NOT_CONFIGURED_DELAY
            row.last_error = str(exc)
            continue
        except (TelegramError, UnknownEventError, KeyError) as exc:
            row.attempts += 1
            row.last_error = str(exc) or type(exc).__name__
            retryable = isinstance(exc, TelegramError) and exc.retryable
            if retryable and row.attempts < MAX_ATTEMPTS:
                delay = backoff(row.attempts)
                if isinstance(exc, TelegramError) and exc.retry_after:
                    delay = max(delay, timedelta(seconds=exc.retry_after))
                row.next_attempt_at = now + delay
                logger.warning(
                    "Notification %s failed (attempt %s), retry in %s: %s",
                    row.id,
                    row.attempts,
                    delay,
                    row.last_error,
                )
            else:
                row.status = OutboxStatus.FAILED
                logger.error("Notification %s failed permanently: %s", row.id, row.last_error)
            continue
        row.status = OutboxStatus.SENT
        row.attempts += 1
        row.sent_at = datetime.now(UTC)
        row.last_error = None
        logger.info("Notification %s (%s) sent", row.id, row.event_type)
    await session.commit()
    return len(rows)
