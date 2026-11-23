"""Titles and descriptions for search results and link previews.

One source of truth: the storefront gets them through the catalog API, crawlers in the
server-rendered HTML (app/services/pages.py), so both always show the same text.
"""

import re
from decimal import Decimal

from app.models.catalog import Category, Product

SITE_NAME = "Fruchi"
HOME_TITLE = "Фруктові чіпси та сушені фрукти з доставкою по Україні"
HOME_DESCRIPTION = (
    "Fruchi — тонко нарізані й висушені фруктові чіпси без цукру. Доставка Новою поштою по Україні."
)
DELIVERY_NOTE = "Доставка Новою поштою по Україні."
# Search engines cut longer descriptions anyway.
MAX_DESCRIPTION = 200

_BULLET = re.compile(r"^\s*[-–—•*]\s+")


def full_title(title: str | None) -> str:
    """Page title with the site name, as it goes into <title>."""
    return f"{title} | {SITE_NAME}" if title else f"{HOME_TITLE} | {SITE_NAME}"


def plain_text(text: str) -> str:
    """Admin-panel text (lines, "- " bullets) as one plain sentence-like string."""
    lines = (_BULLET.sub("", line).strip() for line in text.splitlines())
    return " ".join(line for line in lines if line)


def shorten(text: str, limit: int = MAX_DESCRIPTION) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(",.;:—– ")
    return f"{cut}…"


def format_price(price: Decimal) -> str:
    return f"{price:.0f}" if price == price.to_integral_value() else f"{price:.2f}"


def category_title(category: Category) -> str:
    return category.seo_title or f"{category.name} — купити з доставкою по Україні"


def category_description(category: Category) -> str:
    if category.seo_description:
        return category.seo_description
    text = plain_text(category.description) or f"{category.name} від {SITE_NAME}."
    return shorten(f"{text} {DELIVERY_NOTE}")


def product_title(product: Product) -> str:
    if product.seo_title:
        return product.seo_title
    return f"{product.name} — {product.category.name.lower()}, {product.weight_g} г, купити"


def product_description(product: Product) -> str:
    if product.seo_description:
        return product.seo_description
    text = plain_text(product.short_desc or product.description)
    offer = f"{product.weight_g} г — {format_price(product.price)} грн. {DELIVERY_NOTE}"
    # Keep the price and delivery note: shorten the product text, not the offer.
    room = MAX_DESCRIPTION - len(offer) - 1
    return f"{shorten(text, room)} {offer}" if text else offer
