import re
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.models.orders import PaymentMethod
from app.schemas.catalog import Money

Text = Annotated[str, StringConstraints(strip_whitespace=True)]


def normalize_phone(value: str) -> str:
    """Accepts +380XXXXXXXXX, 380…, 0XXXXXXXXX with any separators; returns +380XXXXXXXXX."""
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10 and digits.startswith("0"):
        digits = "38" + digits
    if len(digits) != 12 or not digits.startswith("380"):
        raise ValueError("Вкажіть український номер у форматі +380XXXXXXXXX")
    return "+" + digits


class CartLine(BaseModel):
    slug: str = Field(max_length=120)
    qty: int = Field(ge=1, le=100)


class CartValidateRequest(BaseModel):
    slugs: list[str] = Field(max_length=50)


class OrderCreate(BaseModel):
    customer_name: Annotated[Text, StringConstraints(min_length=2, max_length=200)]
    phone: str
    city: Annotated[Text, StringConstraints(min_length=2, max_length=200)]
    np_branch: Annotated[Text, StringConstraints(min_length=1, max_length=300)]
    payment_method: PaymentMethod
    comment: Annotated[Text, StringConstraints(max_length=1000)] = ""
    items: list[CartLine] = Field(min_length=1, max_length=50)
    # Honeypot: hidden from people in the form, bots tend to fill it in.
    website: str = ""

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)


class OrderItemOut(BaseModel):
    name: str
    weight_g: int
    unit_price: Money
    qty: int
    line_total: Money


class OrderCreated(BaseModel):
    number: str
    items_total: Money
    payment_method: PaymentMethod
    items: list[OrderItemOut]


class Unavailable(BaseModel):
    slug: str
    name: str | None
    # How many packs can still be ordered (0 — sold out or no longer sold).
    available: int


class OutOfStockResponse(BaseModel):
    detail: str
    items: list[Unavailable]
