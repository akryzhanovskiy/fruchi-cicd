from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.models.catalog import CatalogStatus, Illustration
from app.schemas.catalog import Money

Slug = Annotated[
    str,
    StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=120),
]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
SeoTitle = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
SeoDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=400)]


class CategoryIn(BaseModel):
    slug: Slug
    name: Name
    description: LongText = ""
    seo_title: SeoTitle = ""
    seo_description: SeoDescription = ""
    status: CatalogStatus = CatalogStatus.ACTIVE
    sort_order: int = 0


class CategoryAdmin(CategoryIn):
    id: int
    product_count: int


class AdminImage(BaseModel):
    id: int
    url: str
    alt: str
    sort_order: int


class ProductIn(BaseModel):
    category_id: int
    slug: Slug
    name: Name
    short_desc: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""
    description: LongText = ""
    composition: LongText = ""
    nutrition: LongText = ""
    storage: LongText = ""
    seo_title: SeoTitle = ""
    seo_description: SeoDescription = ""
    accent_color: HexColor = "#F3E1CF"
    illustration: Illustration | None = None
    weight_g: int = Field(gt=0, le=100_000)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    sku: Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] | None = None
    stock_qty: int = Field(ge=0, le=1_000_000)
    # Shown on the storefront. Whether it can be bought ("Скінчився" or not) follows stock.
    visible: bool = True
    sort_order: int = 0


class ProductAdmin(BaseModel):
    id: int
    category_id: int
    category_name: str
    slug: str
    name: str
    short_desc: str
    description: str
    composition: str
    nutrition: str
    storage: str
    seo_title: str
    seo_description: str
    accent_color: str
    illustration: Illustration | None
    weight_g: int
    price: Money
    sku: str | None
    stock_qty: int
    status: CatalogStatus
    visible: bool
    sort_order: int
    images: list[AdminImage]
    created_at: datetime
    updated_at: datetime


class StockAdjust(BaseModel):
    delta: int = Field(ge=-1_000_000, le=1_000_000)
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""

    @field_validator("delta")
    @classmethod
    def _non_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("Зміна залишку не може бути нульовою")
        return value


class ImageUpdate(BaseModel):
    alt: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]


class ImageOrder(BaseModel):
    ids: list[int]
