"""Product feed for Google Merchant Center (free listings and Shopping ads).

The same RSS 2.0 + g: format is accepted by Meta Commerce Manager (Facebook / Instagram
catalog), so one feed serves both.
"""

from xml.sax.saxutils import escape

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services import catalog, meta
from app.services.pages import absolute

# https://support.google.com/merchants/answer/6324436 — "Food Items > Snack Foods"
GOOGLE_CATEGORY = "Food, Beverages & Tobacco > Food Items > Snack Foods"


def _tag(name: str, value: str) -> str:
    return f"<g:{name}>{escape(value)}</g:{name}>"


async def google_feed(session: AsyncSession) -> str:
    site = get_settings().site_url
    items = []
    for product in await catalog.list_products(session):
        # Merchant Center rejects products without a photo; drawings don't count.
        if not product.images:
            continue
        images = [absolute(catalog.image_url(i.object_key)) for i in product.images]
        fields = [
            _tag("id", product.sku or product.slug),
            _tag(
                "title", f"{product.name} — {product.category.name.lower()}, {product.weight_g} г"
            ),
            _tag("description", meta.plain_text(product.description or product.short_desc)),
            _tag("link", f"{site}/product/{product.slug}"),
            _tag("image_link", images[0]),
            *(_tag("additional_image_link", url) for url in images[1:10]),
            _tag("availability", "in_stock" if product.in_stock else "out_of_stock"),
            _tag("price", f"{product.price:.2f} UAH"),
            _tag("brand", meta.SITE_NAME),
            _tag("condition", "new"),
            _tag("identifier_exists", "no"),
            _tag("google_product_category", GOOGLE_CATEGORY),
            _tag("product_type", product.category.name),
            _tag("shipping_weight", f"{product.weight_g} g"),
        ]
        items.append(f"<item>{''.join(fields)}</item>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>'
        f"<title>{meta.SITE_NAME}</title><link>{site}/</link>"
        f"<description>{escape(meta.HOME_DESCRIPTION)}</description>"
        f"{''.join(items)}</channel></rss>"
    )
