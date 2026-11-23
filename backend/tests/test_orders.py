import asyncio
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import (
    CatalogStatus,
    Category,
    NotificationOutbox,
    Order,
    PaymentStatus,
    Product,
    StockMovement,
)
from app.schemas.orders import normalize_phone


@pytest.fixture
async def products(session):
    chips = Category(slug="chips", name="Чіпси")
    session.add_all(
        [
            Product(
                slug="apple",
                name="Яблучні",
                category=chips,
                weight_g=100,
                price=Decimal("89.00"),
                stock_qty=10,
            ),
            Product(
                slug="pear",
                name="Грушеві",
                category=chips,
                weight_g=100,
                price=Decimal("95.50"),
                stock_qty=2,
            ),
            Product(
                slug="lemon",
                name="Лимонні",
                category=chips,
                weight_g=100,
                price=Decimal("99.00"),
                stock_qty=0,
                status=CatalogStatus.COMING_SOON,
            ),
        ]
    )
    await session.commit()


def order_payload(items, **overrides):
    return {
        "customer_name": "Олена Петренко",
        "phone": "067 123 45 67",
        "city": "Київ",
        "np_branch": "Відділення №12",
        "payment_method": "cod",
        "items": items,
    } | overrides


async def stock(session, slug):
    session.expire_all()
    return await session.scalar(select(Product).where(Product.slug == slug))


async def test_create_order_deducts_stock(client, session, products):
    response = await client.post(
        "/api/v1/orders",
        json=order_payload([{"slug": "apple", "qty": 3}, {"slug": "pear", "qty": 1}]),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["number"].startswith("FR-")
    assert body["items_total"] == 3 * 89 + 95.5
    assert [i["qty"] for i in body["items"]] == [3, 1]

    order = await session.scalar(select(Order))
    assert order.phone == "+380671234567"
    assert order.payment_status == PaymentStatus.NOT_REQUIRED
    assert (await stock(session, "apple")).stock_qty == 7
    movements = (await session.scalars(select(StockMovement))).all()
    assert sorted(m.delta for m in movements) == [-3, -1]
    outbox = (await session.scalars(select(NotificationOutbox))).all()
    assert [e.event_type for e in outbox] == ["order_created"]


async def test_selling_last_packs_marks_product_sold_out(client, session, products):
    response = await client.post(
        "/api/v1/orders",
        json=order_payload([{"slug": "pear", "qty": 2}], payment_method="card_transfer"),
    )
    assert response.status_code == 201

    pear = await stock(session, "pear")
    assert pear.stock_qty == 0
    assert pear.status == CatalogStatus.COMING_SOON
    order = await session.scalar(select(Order))
    assert order.payment_status == PaymentStatus.AWAITING
    events = {e.event_type for e in (await session.scalars(select(NotificationOutbox))).all()}
    assert events == {"order_created", "product_sold_out"}

    card = (await client.get("/api/v1/products/pear")).json()
    assert card["in_stock"] is False


async def test_duplicate_lines_are_merged(client, session, products):
    response = await client.post(
        "/api/v1/orders",
        json=order_payload([{"slug": "apple", "qty": 1}, {"slug": "apple", "qty": 2}]),
    )
    assert response.status_code == 201
    assert response.json()["items"][0]["qty"] == 3


async def test_insufficient_stock_rejects_whole_order(client, session, products):
    response = await client.post(
        "/api/v1/orders",
        json=order_payload(
            [
                {"slug": "apple", "qty": 1},
                {"slug": "pear", "qty": 5},
                {"slug": "lemon", "qty": 1},
                {"slug": "missing", "qty": 1},
            ]
        ),
    )
    assert response.status_code == 409
    items = {i["slug"]: i["available"] for i in response.json()["items"]}
    assert items == {"pear": 2, "lemon": 0, "missing": 0}
    assert (await stock(session, "apple")).stock_qty == 10
    assert await session.scalar(select(Order)) is None


async def test_honeypot_is_rejected(client, products):
    response = await client.post(
        "/api/v1/orders", json=order_payload([{"slug": "apple", "qty": 1}], website="spam")
    )
    assert response.status_code == 400


async def test_validation_errors(client, products):
    response = await client.post(
        "/api/v1/orders", json=order_payload([], phone="12345", customer_name=" ")
    )
    assert response.status_code == 422
    fields = {e["loc"][-1] for e in response.json()["detail"]}
    assert {"phone", "customer_name", "items"} <= fields


async def test_rate_limit(client, products):
    payload = order_payload([{"slug": "apple", "qty": 1}])
    codes = [(await client.post("/api/v1/orders", json=payload)).status_code for _ in range(6)]
    assert codes == [201] * 5 + [429]


async def test_cart_validate_returns_current_cards(client, products):
    response = await client.post(
        "/api/v1/cart/validate", json={"slugs": ["apple", "lemon", "missing"]}
    )
    assert response.status_code == 200
    cards = {c["slug"]: c for c in response.json()}
    assert set(cards) == {"apple", "lemon"}
    assert cards["lemon"]["in_stock"] is False


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+380671234567", "+380671234567"),
        ("380 67 123 45 67", "+380671234567"),
        ("(067) 123-45-67", "+380671234567"),
    ],
)
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "12345", "+1 555 123 4567", "+38067123456"])
def test_normalize_phone_rejects(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)


async def test_concurrent_orders_cannot_oversell(client, session, products):
    payload = order_payload([{"slug": "pear", "qty": 2}])
    responses = await asyncio.gather(
        client.post("/api/v1/orders", json=payload),
        client.post("/api/v1/orders", json=payload),
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    assert (await stock(session, "pear")).stock_qty == 0
