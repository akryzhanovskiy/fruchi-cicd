import enum
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, str_enum


class CatalogStatus(enum.StrEnum):
    ACTIVE = "active"
    # For products: out of stock — shown with the "Скінчився" badge, can't be ordered.
    COMING_SOON = "coming_soon"
    HIDDEN = "hidden"


class Illustration(enum.StrEnum):
    """Fruit slice drawings from the design, used while a product has no photos."""

    APPLE = "apple"
    PEAR = "pear"
    BANANA = "banana"
    ORANGE = "orange"
    LEMON = "lemon"
    PINEAPPLE = "pineapple"


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    # Optional overrides for search results; empty — generated from the name/description.
    seo_title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    seo_description: Mapped[str] = mapped_column(String(400), default="", server_default="")
    status: Mapped[CatalogStatus] = mapped_column(
        str_enum(CatalogStatus), default=CatalogStatus.ACTIVE
    )
    sort_order: Mapped[int] = mapped_column(default=0)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Product(TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("stock_qty >= 0", name="stock_non_negative"),
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint("weight_g > 0", name="weight_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    short_desc: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    composition: Mapped[str] = mapped_column(Text, default="")
    nutrition: Mapped[str] = mapped_column(Text, default="")
    storage: Mapped[str] = mapped_column(Text, default="")
    seo_title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    seo_description: Mapped[str] = mapped_column(String(400), default="", server_default="")
    accent_color: Mapped[str] = mapped_column(String(7), default="#F3E1CF")
    illustration: Mapped[Illustration | None] = mapped_column(str_enum(Illustration))
    weight_g: Mapped[int] = mapped_column()
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    sku: Mapped[str | None] = mapped_column(String(64), unique=True)
    stock_qty: Mapped[int] = mapped_column(default=0)
    status: Mapped[CatalogStatus] = mapped_column(
        str_enum(CatalogStatus), default=CatalogStatus.ACTIVE
    )
    sort_order: Mapped[int] = mapped_column(default=0)

    category: Mapped[Category] = relationship(back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        order_by="ProductImage.sort_order",
        cascade="all, delete-orphan",
    )

    @property
    def in_stock(self) -> bool:
        return self.status == CatalogStatus.ACTIVE and self.stock_qty > 0


class ProductImage(TimestampMixin, Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(String(300))
    alt: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(default=0)

    product: Mapped[Product] = relationship(back_populates="images")
