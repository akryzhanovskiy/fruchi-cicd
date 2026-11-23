import enum
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    Sequence,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, str_enum


class OrderStatus(enum.StrEnum):
    NEW = "new"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PaymentMethod(enum.StrEnum):
    COD = "cod"  # накладений платіж у Новій пошті
    CARD_TRANSFER = "card_transfer"  # переказ на картку, реквізити надає оператор


class PaymentStatus(enum.StrEnum):
    NOT_REQUIRED = "not_required"
    AWAITING = "awaiting"
    PAID = "paid"


class OrderEventType(enum.StrEnum):
    CREATED = "created"
    STATUS_CHANGE = "status_change"
    PAYMENT = "payment"
    TTN_SET = "ttn_set"
    NOTE = "note"


class StockReason(enum.StrEnum):
    ORDER = "order"
    CANCEL = "cancel"
    MANUAL = "manual"


# Human-friendly order numbers: FR-000001, FR-000002, …
order_number_seq = Sequence("order_number_seq", metadata=Base.metadata)


class Order(TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (CheckConstraint("items_total >= 0", name="total_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        server_default=text("'FR-' || lpad(nextval('order_number_seq')::text, 6, '0')"),
    )
    status: Mapped[OrderStatus] = mapped_column(
        str_enum(OrderStatus), default=OrderStatus.NEW, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str] = mapped_column(String(200))
    np_branch: Mapped[str] = mapped_column(String(300))
    payment_method: Mapped[PaymentMethod] = mapped_column(str_enum(PaymentMethod))
    payment_status: Mapped[PaymentStatus] = mapped_column(str_enum(PaymentStatus))
    items_total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    customer_comment: Mapped[str] = mapped_column(Text, default="")
    operator_note: Mapped[str] = mapped_column(Text, default="")
    ttn: Mapped[str | None] = mapped_column(String(40))

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    events: Mapped[list["OrderEvent"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderEvent.id"
    )


class OrderItem(Base):
    """Snapshot of what was bought — later product edits don't change past orders."""

    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("qty > 0", name="qty_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), index=True
    )
    product_name: Mapped[str] = mapped_column(String(200))
    weight_g: Mapped[int] = mapped_column()
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    qty: Mapped[int] = mapped_column()

    order: Mapped[Order] = relationship(back_populates="items")

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.qty


class OrderEvent(Base):
    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    type: Mapped[OrderEventType] = mapped_column(str_enum(OrderEventType))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="events")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    delta: Mapped[int] = mapped_column()
    reason: Mapped[StockReason] = mapped_column(str_enum(StockReason))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(String(300), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
