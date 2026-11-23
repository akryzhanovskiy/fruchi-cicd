import json
import re
from decimal import Decimal

import pytest

from app.models import CatalogStatus, Category, Product, ProductImage
from app.services import pages
from tests.conftest import auth

# Shaped like the built storefront index.html.
TEMPLATE = """<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="Static description"
    />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Static" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="canonical" href="https://fruchi.com.ua/" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Static title</title>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>"""


@pytest.fixture(autouse=True)
def template(monkeypatch):
    async def fetch():
        return TEMPLATE

    pages.reset_template_cache()
    monkeypatch.setattr(pages, "fetch_template", fetch)


@pytest.fixture
async def catalog(session):
    chips = Category(slug="susheni-frukty", name="Сушені фрукти", description="Хрумкі фрукти.")
    apple = Product(
        slug="yabluko",
        sku="APL-50",
        name="Яблуко",
        short_desc="Солодко-кислі кільця.",
        description="Тонкі кільця зі шкірочкою.\n- без цукру\n- без олії <script>",
        composition="Яблуко 100%",
        category=chips,
        weight_g=50,
        price=Decimal(89),
        stock_qty=5,
    )
    apple.images.append(ProductImage(object_key="products/1/a.jpg", alt="Яблучні кільця"))
    pear = Product(
        slug="grusha",
        name="Груша",
        category=chips,
        weight_g=50,
        price=Decimal("95.50"),
        status=CatalogStatus.COMING_SOON,
    )
    session.add_all([chips, apple, pear])
    await session.commit()


def json_ld(html: str) -> list[dict]:
    return [
        json.loads(m)
        for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html)
    ]


async def test_product_page_has_meta_structured_data_and_content(client, catalog):
    response = await client.get("/api/v1/page/product/yabluko")
    assert response.status_code == 200
    html = response.text

    assert html.count("<title>") == 1
    assert "<title>Яблуко — сушені фрукти, 50 г, купити | Fruchi</title>" in html
    assert html.count('name="description"') == 1
    assert "Солодко-кислі кільця. 50 г — 89 грн." in html
    assert '<link rel="canonical" href="https://fruchi.com.ua/product/yabluko">' in html
    assert 'content="https://fruchi.com.ua/media/products/1/a.jpg"' in html
    assert '<meta property="og:type" content="product">' in html
    assert "Static" not in html
    assert '<link rel="icon"' in html and "/assets/index-abc.js" in html

    product, breadcrumbs = json_ld(html)
    assert product["@type"] == "Product"
    assert product["sku"] == "APL-50"
    assert product["image"] == ["https://fruchi.com.ua/media/products/1/a.jpg"]
    assert product["offers"]["price"] == "89.00"
    assert product["offers"]["priceCurrency"] == "UAH"
    assert product["offers"]["availability"] == "https://schema.org/InStock"
    assert "category" not in product
    shipping = product["offers"]["shippingDetails"]
    assert shipping["shippingRate"] == {
        "@type": "MonetaryAmount",
        "value": "90.00",
        "currency": "UAH",
    }
    assert shipping["shippingDestination"]["addressCountry"] == "UA"
    returns = product["offers"]["hasMerchantReturnPolicy"]
    assert returns["applicableCountry"] == "UA"
    assert returns["merchantReturnLink"] == "https://fruchi.com.ua/offer"
    assert [i["name"] for i in breadcrumbs["itemListElement"]] == [
        "Головна",
        "Сушені фрукти",
        "Яблуко",
    ]
    # Admin text is escaped in the markup and can't break out of the JSON-LD script.
    assert "<script>" not in html.split('<div id="root">')[1]
    assert "&lt;script&gt;" in html
    assert "<h1>Яблуко</h1>" in html
    assert "<li>без цукру</li>" in html
    assert "<h2>Склад</h2><p>Яблуко 100%</p>" in html


async def test_sold_out_product_and_category_page(client, catalog):
    pear = (await client.get("/api/v1/page/product/grusha")).text
    assert json_ld(pear)[0]["offers"]["availability"] == "https://schema.org/OutOfStock"
    assert '<meta property="og:image:width"' in pear  # falls back to the site image

    response = await client.get("/api/v1/page/catalog/susheni-frukty")
    assert response.status_code == 200
    assert "<title>Сушені фрукти — купити з доставкою по Україні | Fruchi</title>" in response.text
    assert '<a href="/product/yabluko">Яблуко</a> — 89 грн, 50 г' in response.text
    assert "Груша</a> — 95.50 грн, 50 г (немає в наявності)" in response.text


async def test_home_and_text_pages(client, catalog):
    home = (await client.get("/api/v1/page/")).text
    assert "<title>Фруктові чіпси та сушені фрукти з доставкою по Україні | Fruchi</title>" in home
    assert '<link rel="canonical" href="https://fruchi.com.ua/">' in home
    types = [item["@type"] for item in json_ld(home)]
    assert types == ["Organization", "WebSite"]
    assert '<a href="/catalog/susheni-frukty">Сушені фрукти</a>' in home

    delivery = await client.get("/api/v1/page/delivery")
    assert delivery.status_code == 200
    assert "<title>Доставка й оплата | Fruchi</title>" in delivery.text


@pytest.mark.parametrize(
    "path", ["product/nope", "catalog/nope", "something", "product/yabluko/extra"]
)
async def test_unknown_pages_are_real_404(client, catalog, path):
    response = await client.get(f"/api/v1/page/{path}")
    assert response.status_code == 404
    assert response.headers["x-robots-tag"] == "noindex"
    assert '<meta name="robots" content="noindex">' in response.text
    assert "canonical" not in response.text
    assert "Сторінку не знайдено" in response.text


async def test_order_page_is_not_indexed(client):
    response = await client.get("/api/v1/page/order/F-1001")
    assert response.status_code == 200
    assert '<meta name="robots" content="noindex">' in response.text


async def test_hidden_product_is_404(client, session, catalog):
    product = await session.get(Product, 1)
    product.status = CatalogStatus.HIDDEN
    await session.commit()
    assert (await client.get("/api/v1/page/product/yabluko")).status_code == 404


async def test_template_unavailable_lets_nginx_fall_back(client, monkeypatch):
    async def broken():
        raise pages.TemplateUnavailableError("down")

    pages.reset_template_cache()
    monkeypatch.setattr(pages, "fetch_template", broken)
    assert (await client.get("/api/v1/page/")).status_code == 503


async def test_verification_and_analytics_from_settings(client, admin):
    bad = await client.patch(
        "/api/v1/admin/settings", json={"ga_measurement_id": "UA-1"}, headers=auth(admin)
    )
    assert bad.status_code == 422
    saved = await client.patch(
        "/api/v1/admin/settings",
        json={
            "ga_measurement_id": "G-ABC123",
            "meta_pixel_id": "1234567890",
            "google_site_verification": "abc_DEF-123",
            "bing_site_verification": "B1NG",
        },
        headers=auth(admin),
    )
    assert saved.status_code == 200
    html = (await client.get("/api/v1/page/")).text
    assert '<meta name="google-site-verification" content="abc_DEF-123">' in html
    assert '<meta name="msvalidate.01" content="B1NG">' in html
    assert 'window.__FRUCHI_ANALYTICS__={"ga": "G-ABC123", "pixel": "1234567890"}' in html


async def test_without_analytics_no_tracker_config(client):
    assert "__FRUCHI_ANALYTICS__" not in (await client.get("/api/v1/page/")).text


async def test_google_feed(client, catalog):
    response = await client.get("/api/v1/feed/google.xml")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    xml = response.text
    assert "<g:id>APL-50</g:id>" in xml
    assert "<g:price>89.00 UAH</g:price>" in xml
    assert "<g:availability>in_stock</g:availability>" in xml
    assert "<g:link>https://fruchi.com.ua/product/yabluko</g:link>" in xml
    assert "<g:image_link>https://fruchi.com.ua/media/products/1/a.jpg</g:image_link>" in xml
    assert "&lt;script&gt;" in xml
    # No photo — Merchant Center would reject it.
    assert "grusha" not in xml


async def test_catalog_api_returns_meta(client, session, catalog):
    product = (await client.get("/api/v1/products/yabluko")).json()
    assert product["meta_title"] == "Яблуко — сушені фрукти, 50 г, купити"
    assert product["meta_description"] == (
        "Солодко-кислі кільця. 50 г — 89 грн. Доставка Новою поштою по Україні."
    )
    category = (await client.get("/api/v1/categories")).json()[0]
    assert category["meta_description"] == "Хрумкі фрукти. Доставка Новою поштою по Україні."

    apple = await session.get(Product, 1)
    apple.seo_title = "Яблучні чіпси без цукру"
    apple.seo_description = "Свій опис"
    await session.commit()
    product = (await client.get("/api/v1/products/yabluko")).json()
    assert product["meta_title"] == "Яблучні чіпси без цукру"
    assert product["meta_description"] == "Свій опис"


async def test_admin_saves_seo_fields(client, admin, session):
    category = Category(slug="chips", name="Чіпси")
    session.add(category)
    await session.commit()
    created = await client.post(
        "/api/v1/admin/products",
        json={
            "category_id": category.id,
            "slug": "apple",
            "name": "Яблучні чіпси",
            "weight_g": 50,
            "price": "89",
            "stock_qty": 1,
            "seo_title": "  Яблучні чіпси купити  ",
            "seo_description": "Опис для Google",
        },
        headers=auth(admin),
    )
    assert created.status_code == 201
    assert created.json()["seo_title"] == "Яблучні чіпси купити"
    assert created.json()["seo_description"] == "Опис для Google"

    updated = await client.put(
        f"/api/v1/admin/categories/{category.id}",
        json={"slug": "chips", "name": "Чіпси", "seo_title": "Фруктові чіпси"},
        headers=auth(admin),
    )
    assert updated.status_code == 200
    assert updated.json()["seo_title"] == "Фруктові чіпси"


def test_long_description_keeps_price():
    from app.services import meta

    product = Product(
        name="Яблуко",
        short_desc="дуже " * 100,
        description="",
        weight_g=50,
        price=Decimal(89),
        seo_title="",
        seo_description="",
    )
    text = meta.product_description(product)
    assert len(text) <= meta.MAX_DESCRIPTION
    assert text.endswith("50 г — 89 грн. Доставка Новою поштою по Україні.")
    assert "…" in text
