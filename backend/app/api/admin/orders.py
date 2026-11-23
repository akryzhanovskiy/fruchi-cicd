import asyncio
import json
from collections.abc import AsyncIterator
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, Session
from app.models import Order, OrderStatus, PaymentMethod, PaymentStatus
from app.notifications.live import order_events
from app.schemas.admin_orders import OrderDetail, OrderList, OrderUpdate
from app.services import admin_orders as svc

router = APIRouter(prefix="/orders", tags=["admin: orders"])


@router.get("")
async def list_orders(
    session: Session,
    _: CurrentUser,
    status_: Annotated[OrderStatus | None, Query(alias="status")] = None,
    payment_status: PaymentStatus | None = None,
    payment_method: PaymentMethod | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> OrderList:
    return await svc.list_orders(
        session,
        status=status_,
        payment_status=payment_status,
        payment_method=payment_method,
        q=q,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


# The stream ends after a while so the client reconnects with a fresh access token —
# a deactivated user stops getting events within this time.
STREAM_MAX_SECONDS = 10 * 60
HEARTBEAT_SECONDS = 15


@router.get("/stream", response_class=StreamingResponse)
async def stream_orders(request: Request, session: Session, _: CurrentUser) -> StreamingResponse:
    """Server-Sent Events: `order_created` / `order_updated` with `{id, number}`."""
    # Auth is done: give the DB connection back to the pool for the stream's lifetime.
    await session.close()

    async def events() -> AsyncIterator[str]:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + STREAM_MAX_SECONDS
        async with order_events.subscribe() as queue:
            yield "retry: 3000\n\nevent: ready\ndata: {}\n\n"
            while (left := deadline - loop.time()) > 0:
                if await request.is_disconnected():
                    return
                try:
                    payload = await asyncio.wait_for(
                        queue.get(), timeout=min(HEARTBEAT_SECONDS, left)
                    )
                except TimeoutError:
                    yield ": ping\n\n"
                    continue
                event = json.loads(payload).get("type", "message")
                yield f"event: {event}\ndata: {payload}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _order_or_404(session: Session, order_id: int) -> Order:
    order = await svc.get_order(session, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Замовлення не знайдено")
    return order


@router.get("/{order_id}")
async def get_order(order_id: int, session: Session, _: CurrentUser) -> OrderDetail:
    return await svc.to_detail(session, await _order_or_404(session, order_id))


@router.patch("/{order_id}")
async def update_order(
    order_id: int, body: OrderUpdate, session: Session, user: CurrentUser
) -> OrderDetail:
    order = await _order_or_404(session, order_id)
    try:
        await svc.update_order(session, order, body, user)
    except svc.OrderUpdateError as exc:
        await session.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return await svc.to_detail(session, await _order_or_404(session, order_id))
