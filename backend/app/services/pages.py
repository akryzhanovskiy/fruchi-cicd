"""Server-side HTML for storefront pages.

The storefront is a single-page app: without this, every URL returns the same empty
index.html and only crawlers that run JavaScript see any content. nginx sends page
requests here; we take the built index.html, put the page's title, meta tags, structured
data (JSON-LD) and a plain-HTML version of its content into it, and answer with the right
status code (404 for unknown pages). In the browser React then renders the page as usual.
"""

import html
import json
import re
import time
from dataclasses import dataclass, field
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.catalog import Category, Product
from app.schemas.settings import ShopSettings
from app.services import catalog, meta
from app.services import settings as shop_settings

TEMPLATE_TTL_SECONDS = 60

# Shop details for structured data; keep in sync with frontend/storefront/src/lib/site.ts.
SHOP = {
    "phone": "+380979798274",
    "email": "fruchi.snacks@gmail.com",
    "same_as": [
        "https://www.instagram.com/fruchi.snacks/",
        "https://www.facebook.com/people/Fruchi-Snacks/61596104812380/",
    ],
}

# Text pages: path -> (title, description); the same as in the storefront's TextPage props.
STATIC_PAGES = {
    "/delivery": (
        "Доставка й оплата",
        "Доставка фруктових чіпсів Fruchi Новою поштою по Україні у відділення або поштомат. "
        "Оплата при отриманні або переказом на картку.",
    ),
    "/offer": (
        "Договір публічної оферти",
        "Умови купівлі товарів в інтернет-магазині Fruchi: оформлення замовлення, оплата, "
        "доставка, повернення.",
    ),
    "/privacy": (
        "Політика конфіденційності",
        "Які дані збирає інтернет-магазин Fruchi, навіщо і як ми їх захищаємо.",
    ),
}

NOT_FOUND_TITLE = "Сторінку не знайдено"


class TemplateUnavailableError(Exception):
    """index.html can't be fetched — nginx falls back to serving it unchanged."""


@dataclass
class Page:
    title: str
    description: str
    path: str
    status: int = 200
    noindex: bool = False
    og_type: str = "website"
    image: str | None = None
    json_ld: list[dict[str, Any]] = field(default_factory=list)
    body: str = ""


# --- index.html template ---

_template_cache: tuple[float, str] | None = None


async def fetch_template() -> str:
    base = get_settings().storefront_internal_url.rstrip("/")
    if not base:
        raise TemplateUnavailableError("STOREFRONT_INTERNAL_URL is not set")
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{base}/index.html")
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise TemplateUnavailableError(str(exc)) from exc
    return response.text


async def get_template() -> str:
    """The built index.html, cached briefly (it only changes on deploy)."""
    global _template_cache
    now = time.monotonic()
    if _template_cache and now - _template_cache[0] < TEMPLATE_TTL_SECONDS:
        return _template_cache[1]
    template = await fetch_template()
    _template_cache = (now, template)
    return template


def reset_template_cache() -> None:
    global _template_cache
    _template_cache = None


# --- Helpers ---


def absolute(url: str) -> str:
    return url if url.startswith(("http://", "https://")) else get_settings().site_url + url


def _e(text: str) -> str:
    return html.escape(text, quote=True)


def _rich_text(text: str) -> str:
    """Admin-panel text (one paragraph per line, "- " bullets) as HTML."""
    parts: list[str] = []
    items: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        bullet = re.match(r"^[-–—•*]\s+(.*)$", line)
        if bullet:
            items.append(f"<li>{_e(bullet.group(1))}</li>")
            continue
        if items:
            parts.append(f"<ul>{''.join(items)}</ul>")
            items = []
        parts.append(f"<p>{_e(line)}</p>")
    if items:
        parts.append(f"<ul>{''.join(items)}</ul>")
    return "".join(parts)


def _product_list(products: list[Product]) -> str:
    items = "".join(
        f'<li><a href="/product/{_e(p.slug)}">{_e(p.name)}</a> — '
        f"{meta.format_price(p.price)} грн, {p.weight_g} г"
        f"{'' if p.in_stock else ' (немає в наявності)'}</li>"
        for p in products
    )
    return f"<ul>{items}</ul>" if items else ""


def _breadcrumbs(trail: list[tuple[str, str]]) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i, "name": name, "item": absolute(path)}
            for i, (name, path) in enumerate(trail, start=1)
        ],
    }


def _breadcrumbs_html(trail: list[tuple[str, str]]) -> str:
    links = " / ".join(f'<a href="{_e(path)}">{_e(name)}</a>' for name, path in trail[:-1])
    return f'<nav aria-label="Навігація">{links} / {_e(trail[-1][0])}</nav>'


def organization() -> dict[str, Any]:
    site = get_settings().site_url
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": f"{site}/#organization",
        "name": meta.SITE_NAME,
        "url": f"{site}/",
        "logo": f"{site}/og-image.png",
        "email": SHOP["email"],
        "telephone": SHOP["phone"],
        "sameAs": SHOP["same_as"],
    }


def website() -> dict[str, Any]:
    site = get_settings().site_url
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": meta.SITE_NAME,
        "url": f"{site}/",
        "inLanguage": "uk",
        "publisher": {"@id": f"{site}/#organization"},
    }


# Same as configured in Google Merchant Center: Nova Poshta across Ukraine, flat rate.
SHIPPING_DETAILS: dict[str, Any] = {
    "@type": "OfferShippingDetails",
    "shippingRate": {"@type": "MonetaryAmount", "value": "90.00", "currency": "UAH"},
    "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "UA"},
    "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY",
        },
        "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY",
        },
    },
}
# Food of proper quality can't be returned; defects are handled per the offer (/offer, §9).
RETURN_POLICY: dict[str, Any] = {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "UA",
    "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
}


def product_ld(product: Product) -> dict[str, Any]:
    url = absolute(f"/product/{product.slug}")
    data: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": meta.plain_text(product.description or product.short_desc),
        "sku": product.sku or product.slug,
        "url": url,
        "brand": {"@type": "Brand", "name": meta.SITE_NAME},
        "weight": {"@type": "QuantitativeValue", "value": product.weight_g, "unitCode": "GRM"},
        "offers": {
            "@type": "Offer",
            "url": url,
            "priceCurrency": "UAH",
            "price": f"{product.price:.2f}",
            "availability": "https://schema.org/"
            + ("InStock" if product.in_stock else "OutOfStock"),
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {"@id": f"{get_settings().site_url}/#organization"},
            "shippingDetails": SHIPPING_DETAILS,
            "hasMerchantReturnPolicy": {
                **RETURN_POLICY,
                "merchantReturnLink": absolute("/offer"),
            },
        },
    }
    images = [absolute(catalog.image_url(i.object_key)) for i in product.images]
    if images:
        data["image"] = images
    return data


def _site_nav(categories: list[Category]) -> str:
    links = [("Головна", "/")]
    links += [(c.name, f"/catalog/{c.slug}") for c in categories]
    links += [("Доставка й оплата", "/delivery")]
    items = "".join(f'<li><a href="{_e(path)}">{_e(name)}</a></li>' for name, path in links)
    return f'<nav aria-label="Розділи"><ul>{items}</ul></nav>'


# --- Pages ---


async def build_page(session: AsyncSession, path: str) -> Page:
    path = "/" + path.strip("/")
    categories = list(await catalog.list_categories(session))
    nav = _site_nav(categories)

    if path == "/":
        products = list(await catalog.list_products(session))
        return Page(
            title=meta.full_title(None),
            description=meta.HOME_DESCRIPTION,
            path="/",
            json_ld=[organization(), website()],
            body=(
                f"{nav}<h1>Фрукти, що хрумтять</h1>"
                "<p>Тонко нарізані й висушені фруктові чіпси. Смаколик, який легко взяти "
                "з собою на роботу, в школу чи в дорогу.</p>"
                f"<h2>Наші смаки</h2>{_product_list(products)}"
            ),
        )

    if path in STATIC_PAGES:
        title, description = STATIC_PAGES[path]
        return Page(
            title=meta.full_title(title),
            description=description,
            path=path,
            body=f"{nav}<h1>{_e(title)}</h1><p>{_e(description)}</p>",
        )

    if path.startswith("/order/"):
        return Page(
            title=meta.full_title("Дякуємо за замовлення"), description="", path=path, noindex=True
        )

    match = re.fullmatch(r"/catalog/([^/]+)", path)
    category = next((c for c in categories if match and c.slug == match.group(1)), None)
    if category is not None:
        products = list(await catalog.list_products(session, category.slug))
        trail = [("Головна", "/"), (category.name, path)]
        return Page(
            title=meta.full_title(meta.category_title(category)),
            description=meta.category_description(category),
            path=path,
            json_ld=[_breadcrumbs(trail)],
            body=(
                f"{nav}{_breadcrumbs_html(trail)}<h1>{_e(category.name)}</h1>"
                f"{_rich_text(category.description)}{_product_list(products)}"
            ),
        )

    match = re.fullmatch(r"/product/([^/]+)", path)
    product = await catalog.get_product(session, match.group(1)) if match else None
    if product is not None:
        trail = [
            ("Головна", "/"),
            (product.category.name, f"/catalog/{product.category.slug}"),
            (product.name, path),
        ]
        image = catalog.image_url(product.images[0].object_key) if product.images else None
        details = [
            ("Склад", product.composition),
            ("Харчова цінність", product.nutrition),
            ("Умови зберігання", product.storage),
        ]
        body = (
            f"{nav}{_breadcrumbs_html(trail)}<h1>{_e(product.name)}</h1>"
            f"<p>{meta.format_price(product.price)} грн · {product.weight_g} г · "
            f"{'в наявності' if product.in_stock else 'немає в наявності'}</p>"
        )
        if product.images:
            first = product.images[0]
            body += (
                f'<img src="{_e(catalog.image_url(first.object_key))}" '
                f'alt="{_e(first.alt or product.name)}" width="600" height="600">'
            )
        body += _rich_text(product.description or product.short_desc)
        for heading, text in details:
            if text.strip():
                body += f"<h2>{heading}</h2>{_rich_text(text)}"
        return Page(
            title=meta.full_title(meta.product_title(product)),
            description=meta.product_description(product),
            path=path,
            og_type="product",
            image=image,
            json_ld=[product_ld(product), _breadcrumbs(trail)],
            body=body,
        )

    return Page(
        title=meta.full_title(NOT_FOUND_TITLE),
        description="",
        path=path,
        status=404,
        noindex=True,
        body=f'{nav}<h1>{NOT_FOUND_TITLE}</h1><p><a href="/">На головну</a></p>',
    )


# --- Rendering into index.html ---

# Tags the template ships with that every page replaces.
_MANAGED_TAGS = [
    re.compile(r"<title>.*?</title>\s*", re.S),
    re.compile(
        r"<meta\s[^>]*?(?:name|property)=\"(?:description|robots|og:[^\"]+|twitter:[^\"]+)\""
        r"[^>]*>\s*",
        re.S,
    ),
    re.compile(r"<link\s[^>]*?rel=\"canonical\"[^>]*>\s*", re.S),
]


def _json_ld_script(data: dict[str, Any]) -> str:
    # "<" escaped so text from the admin panel can't close the script tag.
    payload = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    return f'<script type="application/ld+json">{payload}</script>'


def head_tags(page: Page, shop: ShopSettings) -> str:
    site = get_settings().site_url
    url = site + page.path
    image = absolute(page.image or "/og-image.png")
    tags = [f"<title>{_e(page.title)}</title>"]
    if page.description:
        tags.append(f'<meta name="description" content="{_e(page.description)}">')
    tags.append(f'<meta name="robots" content="{"noindex" if page.noindex else "index, follow"}">')
    if not page.noindex:
        tags.append(f'<link rel="canonical" href="{_e(url)}">')
    og = {
        "og:type": page.og_type,
        "og:site_name": meta.SITE_NAME,
        "og:locale": "uk_UA",
        "og:title": page.title,
        "og:description": page.description or meta.HOME_DESCRIPTION,
        "og:url": url,
        "og:image": image,
    }
    tags += [f'<meta property="{k}" content="{_e(v)}">' for k, v in og.items()]
    if page.image is None:
        tags += [
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
        ]
    tags.append('<meta name="twitter:card" content="summary_large_image">')
    if shop.google_site_verification:
        tags.append(
            f'<meta name="google-site-verification" content="{_e(shop.google_site_verification)}">'
        )
    if shop.bing_site_verification:
        tags.append(f'<meta name="msvalidate.01" content="{_e(shop.bing_site_verification)}">')
    tags += [_json_ld_script(item) for item in page.json_ld]
    analytics = {"ga": shop.ga_measurement_id, "pixel": shop.meta_pixel_id}
    if any(analytics.values()):
        # Read by src/lib/analytics.ts, which loads the trackers.
        tags.append(_analytics_script(analytics))
    return "\n    ".join(tags)


def _analytics_script(config: dict[str, str]) -> str:
    payload = json.dumps(config).replace("<", "\\u003c")
    return f"<script>window.__FRUCHI_ANALYTICS__={payload}</script>"


def render(template: str, page: Page, shop: ShopSettings) -> str:
    out = template
    for pattern in _MANAGED_TAGS:
        out = pattern.sub("", out)
    out = out.replace("</head>", f"    {head_tags(page, shop)}\n  </head>", 1)
    # React replaces this markup on start; crawlers and link previews read it as is.
    out = out.replace('<div id="root"></div>', f'<div id="root">{page.body}</div>', 1)
    return out


async def render_page(session: AsyncSession, path: str) -> tuple[int, str]:
    template = await get_template()
    page = await build_page(session, path)
    shop = await shop_settings.get_settings(session)
    return page.status, render(template, page, shop)
