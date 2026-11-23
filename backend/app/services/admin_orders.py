from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AdminUser,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Product,
    StockReason,
)
from app.notifications.live import notify_orders
from app.schemas.admin_orders import (
    AdminOrderEvent,
    AdminOrderItem,
    OrderDetail,
    OrderList,
    OrderListItem,
    OrderUpdate,
)
from app.services.stock import change_stock

SHOP_TZ = ZoneInfo("Europe/Kyiv")

TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    OrderStatus.SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    OrderStatus.DELIVERED: [OrderStatus.RETURNED],
    OrderStatus.CANCELLED: [],
    OrderStatus.RETURNED: [],
}
# Goods come back to stock when an order is cancelled or returned.
RESTOCK_STATUSES = {OrderStatus.CANCELLED, OrderStatus.RETURNED}


class OrderUpdateError(Exception):
    pass


def day_start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=SHOP_TZ)


async def list_orders(
    session: AsyncSession,
    *,
    status: OrderStatus | None,
    payment_status: PaymentStatus | None,
    payment_method: PaymentMethod | None,
    q: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> OrderList:
    items_count = (
        select(func.coalesce(func.sum(OrderItem.qty), 0))
        .where(OrderItem.order_id == Order.id)
        .scalar_subquery()
    )
    query: Select[Order, int] = select(Order, items_count)
    if status:
        query = query.where(Order.status == status)
    if payment_status:
        query = query.where(Order.payment_status == payment_status)
    if payment_method:
        query = query.where(Order.payment_method == payment_method)
    if q:
        term = q.strip()
        digits = "".join(ch for ch in term if ch.isdigit())
        conditions: list[ColumnElement[bool]] = [
            Order.number.ilike(f"%{term}%"),
            Order.customer_name.ilike(f"%{term}%"),
        ]
        if len(digits) >= 3:
            conditions.append(Order.phone.contains(digits))
        query = query.where(or_(*conditions))
    if date_from:
        query = query.where(Order.created_at >= day_start(date_from))
    if date_to:
        query = query.where(Order.created_at < day_start(date_to + timedelta(days=1)))

    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.execute(
        query.order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    counts = dict(
        (await session.execute(select(Order.status, func.count()).group_by(Order.status))).all()
    )
    return OrderList(
        items=[_list_item(order, n) for order, n in rows.all()],
        total=total,
        page=page,
        page_size=page_size,
        status_counts={s: counts.get(s, 0) for s in OrderStatus},
    )


def _list_item(order: Order, items_count: int) -> OrderListItem:
    return OrderListItem(
        id=order.id,
        number=order.number,
        status=order.status,
        created_at=order.created_at,
        customer_name=order.customer_name,
        phone=order.phone,
        city=order.city,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        items_total=order.items_total,
        items_count=items_count,
        ttn=order.ttn,
    )


async def get_order(session: AsyncSession, order_id: int) -> Order | None:
    return await session.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.events))
        .execution_options(populate_existing=True)
    )


async def to_detail(session: AsyncSession, order: Order) -> OrderDetail:
    user_ids = {e.user_id for e in order.events if e.user_id}
    names = (
        dict(
            (
                await session.execute(
                    select(AdminUser.id, AdminUser.name).where(AdminUser.id.in_(user_ids))
                )
            ).all()
        )
        if user_ids
        else {}
    )
    return OrderDetail(
        **_list_item(order, sum(i.qty for i in order.items)).model_dump(),
        np_branch=order.np_branch,
        customer_comment=order.customer_comment,
        operator_note=order.operator_note,
        updated_at=order.updated_at,
        items=[
            AdminOrderItem(
                product_id=i.product_id,
                product_name=i.product_name,
                weight_g=i.weight_g,
                unit_price=i.unit_price,
                qty=i.qty,
                line_total=i.line_total,
            )
            for i in order.items
        ],
        events=[
            AdminOrderEvent(
                type=e.type,
                payload=e.payload,
                created_at=e.created_at,
                user_name=names.get(e.user_id) if e.user_id else None,
            )
            for e in order.events
        ],
        next_statuses=TRANSITIONS[order.status],
    )


async def update_order(
    session: AsyncSession, order: Order, data: OrderUpdate, user: AdminUser
) -> None:
    def event(type_: OrderEventType, **payload: object) -> None:
        order.events.append(OrderEvent(type=type_, user_id=user.id, payload=payload))

    if data.ttn is not None and data.ttn != (order.ttn or ""):
        order.ttn = data.ttn or None
        event(OrderEventType.TTN_SET, ttn=order.ttn)

    if data.status is not None and data.status != order.status:
        if data.status not in TRANSITIONS[order.status]:
            raise OrderUpdateError("Такий перехід статусу неможливий")
        if data.status == OrderStatus.SHIPPED and not order.ttn:
            raise OrderUpdateError("Щоб позначити замовлення відправленим, вкажіть номер ТТН")
        if data.status in RESTOCK_STATUSES:
            await _restock(session, order, user)
        event(OrderEventType.STATUS_CHANGE, **{"from": order.status, "to": data.status})
        order.status = data.status

    if data.payment_status is not None and data.payment_status != order.payment_status:
        event(
            OrderEventType.PAYMENT,
            **{"from": order.payment_status, "to": data.payment_status},
        )
        order.payment_status = data.payment_status

    if data.operator_note is not None and data.operator_note != order.operator_note:
        order.operator_note = data.operator_note
        event(OrderEventType.NOTE, text=data.operator_note)

    if session.new or session.dirty:
        await notify_orders(session, "order_updated", id=order.id, number=order.number)
    await session.commit()


async def _restock(session: AsyncSession, order: Order, user: AdminUser) -> None:
    ids = [i.product_id for i in order.items if i.product_id]
    products = {
        p.id: p
        for p in await session.scalars(
            select(Product).where(Product.id.in_(ids)).order_by(Product.id).with_for_update()
        )
    }
    for item in order.items:
        product = products.get(item.product_id) if item.product_id else None
        if product:  # deleted products can't be restocked
            session.add(
                change_stock(
                    product, item.qty, StockReason.CANCEL, user_id=user.id, order_id=order.id
                )
            )
