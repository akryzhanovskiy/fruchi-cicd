"""SQLAlchemy models. Import every model module here so Alembic sees its tables."""

from app.db.base import Base
from app.models.catalog import CatalogStatus, Category, Illustration, Product, ProductImage
from app.models.orders import (
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    StockMovement,
    StockReason,
)
from app.models.outbox import NotificationOutbox, OutboxStatus
from app.models.users import AdminUser, Setting, UserRole

__all__ = [
    "AdminUser",
    "Base",
    "CatalogStatus",
    "Category",
    "Illustration",
    "NotificationOutbox",
    "Order",
    "OrderEvent",
    "OrderEventType",
    "OrderItem",
    "OrderStatus",
    "OutboxStatus",
    "PaymentMethod",
    "PaymentStatus",
    "Product",
    "ProductImage",
    "Setting",
    "StockMovement",
    "StockReason",
    "UserRole",
]
