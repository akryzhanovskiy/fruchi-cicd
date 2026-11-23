from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, StringConstraints

from app.models.orders import OrderEventType, OrderStatus, PaymentMethod, PaymentStatus
from app.schemas.catalog import Money


class OrderListItem(BaseModel):
    id: int
    number: str
    status: OrderStatus
    created_at: datetime
    customer_name: str
    phone: str
    city: str
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    items_total: Money
    items_count: int
    ttn: str | None


class OrderList(BaseModel):
    items: list[OrderListItem]
    total: int
    page: int
    page_size: int
    # Counts per status for all orders (ignores filters) — badges on the status tabs.
    status_counts: dict[OrderStatus, int]


class AdminOrderItem(BaseModel):
    product_id: int | None
    product_name: str
    weight_g: int
    unit_price: Money
    qty: int
    line_total: Money


class AdminOrderEvent(BaseModel):
    type: OrderEventType
    payload: dict[str, Any]
    created_at: datetime
    user_name: str | None


class OrderDetail(OrderListItem):
    np_branch: str
    customer_comment: str
    operator_note: str
    updated_at: datetime
    items: list[AdminOrderItem]
    events: list[AdminOrderEvent]
    # Statuses the order can move to from its current one.
    next_statuses: list[OrderStatus]


class OrderUpdate(BaseModel):
    status: OrderStatus | None = None
    payment_status: PaymentStatus | None = None
    ttn: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None = None
    operator_note: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] | None
    ) = None
