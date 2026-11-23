"""Live order updates for the admin panel: PostgreSQL LISTEN/NOTIFY -> SSE.

Business code calls `notify_orders()` inside its transaction; PostgreSQL delivers the
notification on commit (and drops it on rollback). Each API process keeps one LISTEN
connection and fans events out to its open SSE streams.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings

logger = logging.getLogger(__name__)

CHANNEL = "orders"
RECONNECT_DELAY_SECONDS = 2
HEALTHCHECK_SECONDS = 30


async def notify_orders(session: AsyncSession, event: str, **data: Any) -> None:
    payload = json.dumps({"type": event, **data}, ensure_ascii=False, default=str)
    await session.execute(select(func.pg_notify(CHANNEL, payload)))


class OrderEvents:
    """Single LISTEN connection per process, started lazily by the first subscriber."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue[str]] = set()
        self._task: asyncio.Task[None] | None = None
        self.connected = asyncio.Event()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[str]]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
        self._queues.add(queue)
        if self._task is None or self._task.done():
            self.connected = asyncio.Event()
            self._task = asyncio.create_task(self._listen())
        try:
            yield queue
        finally:
            self._queues.discard(queue)

    def _dispatch(self, _conn: object, _pid: int, _channel: str, payload: str) -> None:
        for queue in self._queues:
            with suppress(asyncio.QueueFull):  # a stuck client just misses events
                queue.put_nowait(payload)

    async def _listen(self) -> None:
        while self._queues:
            conn: Any = None
            try:
                conn = await asyncpg.connect(get_settings().asyncpg_dsn)
                await conn.add_listener(CHANNEL, self._dispatch)
                self.connected.set()
                while self._queues:
                    await asyncio.sleep(HEALTHCHECK_SECONDS)
                    await conn.execute("SELECT 1")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.connected.clear()
                logger.warning("Order events listener lost connection: %s", exc)
                await asyncio.sleep(RECONNECT_DELAY_SECONDS)
            finally:
                if conn is not None:
                    with suppress(Exception):
                        await conn.close()
        self.connected.clear()

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None


order_events = OrderEvents()
