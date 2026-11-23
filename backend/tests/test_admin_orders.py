from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Category, Product
from tests.conftest import auth


@pytest.fixture
async def placed_order(client, session):
    chips = Category(slug="chips", name="Чіпси")
    session.add(
        Product(
            slug="apple",
            name="Яблучні",
            category=chips,
            weight_g=100,
            price=Decimal("89.00"),
            stock_qty=2,
        )
    )
    await session.commit()
    response = await client.post(
        "/api/v1/orders",
        json={
            "customer_name": "Олена Петренко",
            "phone": "0671234567",
            "city": "Київ",
            "np_branch": "12",
            "payment_method": "card_transfer",
            "items": [{"slug": "apple", "qty": 2}],
        },
    )
    assert response.status_code == 201
    return response.json()


async def find_order_id(client, admin, number):
    listed = (await client.get("/api/v1/admin/orders", headers=auth(admin))).json()
    return next(o["id"] for o in listed["items"] if o["number"] == number)


async def test_list_and_filter(client, admin, placed_order):
    url = "/api/v1/admin/orders"
    body = (await client.get(url, headers=auth(admin))).json()
    assert body["total"] == 1
    assert body["items"][0]["items_count"] == 2
    assert body["status_counts"]["new"] == 1

    for params, expected in [
        ({"status": "new"}, 1),
        ({"status": "shipped"}, 0),
        ({"q": "петренко"}, 1),
        ({"q": "123 45"}, 1),  # phone digits
        ({"q": placed_order["number"]}, 1),
        ({"payment_status": "awaiting"}, 1),
        ({"date_from": "2000-01-01", "date_to": "2000-01-02"}, 0),
    ]:
        result = (await client.get(url, params=params, headers=auth(admin))).json()
        assert result["total"] == expected, params


async def test_status_flow_with_ttn_and_payment(client, admin, placed_order):
    order_id = await find_order_id(client, admin, placed_order["number"])
    url = f"/api/v1/admin/orders/{order_id}"

    skip = await client.patch(url, json={"status": "delivered"}, headers=auth(admin))
    assert skip.status_code == 400

    confirmed = await client.patch(
        url, json={"status": "confirmed", "payment_status": "paid"}, headers=auth(admin)
    )
    assert confirmed.json()["next_statuses"] == ["shipped", "cancelled"]

    no_ttn = await client.patch(url, json={"status": "shipped"}, headers=auth(admin))
    assert no_ttn.status_code == 400

    shipped = await client.patch(
        url, json={"status": "shipped", "ttn": "20450000000000"}, headers=auth(admin)
    )
    body = shipped.json()
    assert (body["status"], body["ttn"], body["payment_status"]) == (
        "shipped",
        "20450000000000",
        "paid",
    )
    types = [e["type"] for e in body["events"]]
    assert types == ["created", "status_change", "payment", "ttn_set", "status_change"]
    assert body["events"][1]["user_name"] == "Адмін"


async def test_cancel_returns_goods_to_stock(client, session, admin, placed_order):
    product = await session.scalar(select(Product))
    await session.refresh(product)
    assert (product.stock_qty, product.status) == (0, "coming_soon")

    order_id = await find_order_id(client, admin, placed_order["number"])
    response = await client.patch(
        f"/api/v1/admin/orders/{order_id}",
        json={"status": "cancelled", "operator_note": "Клієнт передумав"},
        headers=auth(admin),
    )
    assert response.status_code == 200
    assert response.json()["next_statuses"] == []

    await session.refresh(product)
    assert (product.stock_qty, product.status) == (2, "active")


async def test_dashboard(client, admin, placed_order):
    body = (await client.get("/api/v1/admin/dashboard", headers=auth(admin))).json()
    assert body["orders_today"] == 1
    assert body["new_orders"] == 1
    assert body["awaiting_payment"] == 1
    assert body["revenue_30d"] == 178
    assert [p["name"] for p in body["low_stock"]] == ["Яблучні"]

    daily = body["daily"]
    assert len(daily) == 30
    assert daily[-1]["orders"] == 1 and daily[-1]["revenue"] == 178  # today
    assert sum(d["orders"] for d in daily) == 1
    assert daily[0]["date"] < daily[-1]["date"]
    assert body["top_products"] == [
        {"product_id": body["low_stock"][0]["id"], "name": "Яблучні", "qty": 2, "revenue": 178}
    ]

    # Cancelled orders drop out of the chart and the top.
    order_id = await find_order_id(client, admin, placed_order["number"])
    await client.patch(
        f"/api/v1/admin/orders/{order_id}", json={"status": "cancelled"}, headers=auth(admin)
    )
    body = (await client.get("/api/v1/admin/dashboard", headers=auth(admin))).json()
    assert sum(d["orders"] for d in body["daily"]) == 0
    assert body["top_products"] == []


async def test_users_and_settings(client, admin):
    users_url = "/api/v1/admin/users"
    created = await client.post(
        users_url,
        json={"email": "op@fruchi.com.ua", "name": "Оля", "password": "long-password"},
        headers=auth(admin),
    )
    assert created.status_code == 201
    assert created.json()["role"] == "operator"
    duplicate = await client.post(
        users_url,
        json={"email": "OP@fruchi.com.ua", "name": "Оля", "password": "long-password"},
        headers=auth(admin),
    )
    assert duplicate.status_code == 409

    self_off = await client.patch(
        f"{users_url}/{admin.id}", json={"is_active": False}, headers=auth(admin)
    )
    assert self_off.status_code == 400

    settings = await client.patch(
        "/api/v1/admin/settings",
        json={"payment_details": "Картка 4441 0000 0000 0000", "low_stock_threshold": 3},
        headers=auth(admin),
    )
    assert settings.json()["low_stock_threshold"] == 3
    again = (await client.get("/api/v1/admin/settings", headers=auth(admin))).json()
    assert again["payment_details"].startswith("Картка")
