from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CatalogStatus,
    Category,
    NotificationOutbox,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    PaymentMethod,
    PaymentStatus,
    Product,
    StockMovement,
    StockReason,
)
from app.notifications.live import notify_orders
from app.schemas.orders import OrderCreate, Unavailable
from app.services.catalog import MAX_QTY_PER_ITEM


class OutOfStockError(Exception):
    def __init__(self, items: list[Unavailable]):
        super().__init__("Some items are unavailable")
        self.items = items


async def create_order(session: AsyncSession, data: OrderCreate) -> Order:
    """Creates an order and deducts stock in one transaction.

    Product rows are locked (`SELECT … FOR UPDATE`, in id order to avoid deadlocks), so two
    customers can't buy the last pack at the same time. A product that hits zero stock is
    switched to `coming_soon` ("Скінчився" on the storefront).
    """
    wanted: dict[str, int] = defaultdict(int)
    for line in data.items:
        wanted[line.slug] += line.qty

    products = {
        p.slug: p
        for p in await session.scalars(
            select(Product)
            .join(Product.category)
            .where(
                Product.slug.in_(wanted),
                Product.status == CatalogStatus.ACTIVE,
                Category.status != CatalogStatus.HIDDEN,
            )
            .order_by(Product.id)
            .with_for_update(of=Product)
        )
    }

    problems = []
    for slug, qty in wanted.items():
        product = products.get(slug)
        available = min(product.stock_qty, MAX_QTY_PER_ITEM) if product else 0
        if qty > available:
            problems.append(
                Unavailable(slug=slug, name=product.name if product else None, available=available)
            )
    if problems:
        raise OutOfStockError(problems)

    order = Order(
        customer_name=data.customer_name,
        phone=data.phone,
        city=data.city,
        np_branch=data.np_branch,
        payment_method=data.payment_method,
        payment_status=(
            PaymentStatus.AWAITING
            if data.payment_method == PaymentMethod.CARD_TRANSFER
            else PaymentStatus.NOT_REQUIRED
        ),
        customer_comment=data.comment,
        items_total=Decimal(0),
    )
    sold_out: list[Product] = []
    for slug, qty in wanted.items():
        product = products[slug]
        order.items.append(
            OrderItem(
                product_id=product.id,
                product_name=product.name,
                weight_g=product.weight_g,
                unit_price=product.price,
                qty=qty,
            )
        )
        product.stock_qty -= qty
        if product.stock_qty == 0:
            product.status = CatalogStatus.COMING_SOON
            sold_out.append(product)
    order.items_total = sum((i.line_total for i in order.items), Decimal(0))
    order.events.append(OrderEvent(type=OrderEventType.CREATED, payload={}))
    session.add(order)
    await session.flush()  # assigns order.id and the generated number
    await session.refresh(order, ["number"])

    session.add_all(
        StockMovement(
            product_id=item.product_id, delta=-item.qty, reason=StockReason.ORDER, order_id=order.id
        )
        for item in order.items
    )
    session.add(
        NotificationOutbox(
            event_type="order_created",
            payload={"order_id": order.id, "number": order.number},
        )
    )
    session.add_all(
        NotificationOutbox(
            event_type="product_sold_out",
            payload={"product_id": p.id, "name": p.name},
        )
        for p in sold_out
    )
    await notify_orders(session, "order_created", id=order.id, number=order.number)
    await session.commit()
    return order
