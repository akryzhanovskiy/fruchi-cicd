from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer

from app.models.catalog import Illustration

# Decimal in the DB, plain JSON number on the wire (prices are whole hryvnias or kopecks).
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    description: str
    # Ready-made <title> (without the site name) and meta description for the page.
    meta_title: str
    meta_description: str


class ImageOut(BaseModel):
    url: str
    alt: str


class ProductCard(BaseModel):
    slug: str
    name: str
    short_desc: str
    category: str
    price: Money
    weight_g: int
    accent_color: str
    illustration: Illustration | None
    image: ImageOut | None
    in_stock: bool
    # Upper bound for the quantity picker; the exact stock level is not exposed.
    max_qty: int


class ProductDetail(ProductCard):
    description: str
    composition: str
    nutrition: str
    storage: str
    images: list[ImageOut]
    meta_title: str
    meta_description: str
