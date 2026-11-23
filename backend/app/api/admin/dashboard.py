from datetime import date, datetime, timedelta

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, select

from app.api.deps import CurrentUser, Session
from app.models import CatalogStatus, Order, OrderItem, OrderStatus, PaymentStatus, Product
from app.schemas.catalog import Money
from app.services.admin_orders import SHOP_TZ, day_start
from app.services.settings import get_settings

router = APIRouter(prefix="/dashboard", tags=["admin: dashboard"])


class LowStockProduct(BaseModel):
    id: int
    name: str
    stock_qty: int


class DailyStat(BaseModel):
    date: date
    orders: int
    revenue: Money


class TopProduct(BaseModel):
    product_id: int | None
    name: str
    qty: int
    revenue: Money


CHART_DAYS = 30
TOP_PRODUCTS = 5


class Dashboard(BaseModel):
    orders_today: int
    new_orders: int
    awaiting_payment: int
    orders_30d: int
    revenue_30d: Money
    status_counts: dict[OrderStatus, int]
    low_stock: list[LowStockProduct]
    low_stock_threshold: int
    # Last CHART_DAYS days including today (shop time zone), zero-filled; without
    # cancelled and returned orders.
    daily: list[DailyStat]
    top_products: list[TopProduct]


@router.get("")
async def dashboard(session: Session, _: CurrentUser) -> Dashboard:
    today = day_start(datetime.now(SHOP_TZ).date())
    month_ago = today - timedelta(days=30)
    not_cancelled = Order.status.not_in([OrderStatus.CANCELLED, OrderStatus.RETURNED])

    async def count(*where: ColumnElement[bool]) -> int:
        return await session.scalar(select(func.count()).select_from(Order).where(*where)) or 0

    threshold = (await get_settings(session)).low_stock_threshold
    low_stock = await session.scalars(
        select(Product)
        .where(Product.status != CatalogStatus.HIDDEN, Product.stock_qty <= threshold)
        .order_by(Product.stock_qty, Product.name)
    )
    chart_from = today - timedelta(days=CHART_DAYS - 1)
    day = func.date(func.timezone(SHOP_TZ.key, Order.created_at))
    by_day = {
        d: (n, revenue)
        for d, n, revenue in (
            await session.execute(
                select(day, func.count(), func.sum(Order.items_total))
                .where(Order.created_at >= chart_from, not_cancelled)
                .group_by(day)
            )
        ).all()
    }
    days = [chart_from.date() + timedelta(days=i) for i in range(CHART_DAYS)]
    top = (
        await session.execute(
            select(
                OrderItem.product_id,
                func.max(OrderItem.product_name),
                func.sum(OrderItem.qty).label("qty"),
                func.sum(OrderItem.unit_price * OrderItem.qty),
            )
            .join(Order)
            .where(Order.created_at >= chart_from, not_cancelled)
            .group_by(OrderItem.product_id)
            .order_by(func.sum(OrderItem.qty).desc(), func.max(OrderItem.product_name))
            .limit(TOP_PRODUCTS)
        )
    ).all()
    statuses = dict(
        (await session.execute(select(Order.status, func.count()).group_by(Order.status))).all()
    )
    return Dashboard(
        orders_today=await count(Order.created_at >= today),
        new_orders=statuses.get(OrderStatus.NEW, 0),
        awaiting_payment=await count(Order.payment_status == PaymentStatus.AWAITING, not_cancelled),
        orders_30d=await count(Order.created_at >= month_ago, not_cancelled),
        revenue_30d=await session.scalar(
            select(func.coalesce(func.sum(Order.items_total), 0)).where(
                Order.created_at >= month_ago, not_cancelled
            )
        ),
        status_counts={s: statuses.get(s, 0) for s in OrderStatus},
        low_stock=[LowStockProduct(id=p.id, name=p.name, stock_qty=p.stock_qty) for p in low_stock],
        low_stock_threshold=threshold,
        daily=[
            DailyStat(date=d, orders=by_day.get(d, (0, 0))[0], revenue=by_day.get(d, (0, 0))[1])
            for d in days
        ],
        top_products=[
            TopProduct(product_id=pid, name=name, qty=qty, revenue=revenue)
            for pid, name, qty, revenue in top
        ],
    )
