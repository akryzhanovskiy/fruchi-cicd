"""Notification worker: delivers `notification_outbox` rows to Telegram.

Polls the outbox every few seconds; rows are written in the same transaction as the order,
so nothing is lost while Telegram or the worker itself is down.
"""

import asyncio
import logging
import signal

import httpx

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import SessionLocal, engine
from app.notifications.outbox import process_batch

logger = logging.getLogger("worker")

POLL_INTERVAL_SECONDS = 3


async def run(stop: asyncio.Event) -> None:
    if not get_settings().telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN is not set: notifications stay queued until it is")
    logger.info("Notification worker started")
    async with httpx.AsyncClient(timeout=15) as http:
        while not stop.is_set():
            handled = 0
            try:
                async with SessionLocal() as session:
                    handled = await process_batch(session, http)
            except Exception:
                logger.exception("Outbox processing failed")
            if handled:
                continue  # more rows may be waiting
            try:
                await asyncio.wait_for(stop.wait(), timeout=POLL_INTERVAL_SECONDS)
            except TimeoutError:
                pass
    await engine.dispose()
    logger.info("Notification worker stopped")


async def main() -> None:
    setup_logging(get_settings().log_level)
    # httpx logs every request URL at INFO — and Bot API URLs contain the token.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await run(stop)


if __name__ == "__main__":
    asyncio.run(main())
