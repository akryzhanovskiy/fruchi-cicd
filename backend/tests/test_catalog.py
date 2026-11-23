from decimal import Decimal

import pytest

from app.models import CatalogStatus, Category, Illustration, Product, ProductImage


@pytest.fixture
async def catalog(session):
    chips = Category(slug="chips", name="Фруктові чіпси", sort_order=1)
    hidden_cat = Category(slug="secret", name="Секрет", status=CatalogStatus.HIDDEN)

    def product(slug, **kw):
        defaults = dict(name=slug, weight_g=100, price=Decimal("89.50"), stock_qty=50)
        return Product(slug=slug, **(defaults | kw))

    apple = product(
        "apple",
        category=chips,
        sort_order=1,
        illustration=Illustration.APPLE,
        composition="Яблука",
        images=[
            ProductImage(object_key="p/apple-2.jpg", sort_order=2),
            ProductImage(object_key="p/apple-1.jpg", alt="Пачка", sort_order=1),
        ],
    )
    few_left = product("pear", category=chips, sort_order=2, stock_qty=3)
    sold_out = product(
        "lemon", category=chips, sort_order=3, stock_qty=0, status=CatalogStatus.COMING_SOON
    )
    hidden = product("draft", category=chips, status=CatalogStatus.HIDDEN)
    in_hidden_category = product("secret-chips", category=hidden_cat)
    session.add_all([apple, few_left, sold_out, hidden, in_hidden_category])
    await session.commit()


async def test_list_categories_skips_hidden(client, catalog):
    response = await client.get("/api/v1/categories")
    assert response.status_code == 200
    assert [c["slug"] for c in response.json()] == ["chips"]


async def test_list_products_visibility_and_order(client, catalog):
    response = await client.get("/api/v1/products")
    assert response.status_code == 200
    assert [p["slug"] for p in response.json()] == ["apple", "pear", "lemon"]


async def test_product_card_fields(client, catalog):
    apple, pear, lemon = (await client.get("/api/v1/products")).json()

    assert apple["price"] == 89.5
    assert apple["category"] == "chips"
    assert apple["illustration"] == "apple"
    assert apple["image"] == {"url": "/media/p/apple-1.jpg", "alt": "Пачка"}
    assert apple["in_stock"] is True
    assert apple["max_qty"] == 20  # capped, exact stock is not exposed

    assert pear["max_qty"] == 3
    assert pear["image"] is None

    assert lemon["in_stock"] is False
    assert lemon["max_qty"] == 0


async def test_filter_by_category(client, catalog):
    assert len((await client.get("/api/v1/products?category=chips")).json()) == 3
    assert (await client.get("/api/v1/products?category=secret")).json() == []


async def test_product_detail(client, catalog):
    response = await client.get("/api/v1/products/apple")
    assert response.status_code == 200
    body = response.json()
    assert body["composition"] == "Яблука"
    assert [i["url"] for i in body["images"]] == ["/media/p/apple-1.jpg", "/media/p/apple-2.jpg"]
    assert body["images"][1]["alt"] == "apple"  # falls back to product name


@pytest.mark.parametrize("slug", ["draft", "secret-chips", "missing"])
async def test_product_detail_not_found(client, catalog, slug):
    response = await client.get(f"/api/v1/products/{slug}")
    assert response.status_code == 404
