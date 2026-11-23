from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models import Category, Product, StockMovement
from app.services import admin_catalog
from tests.conftest import auth

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


class FakeS3:
    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, **kwargs):  # noqa: N803 - boto3 signature
        self.objects[Key] = Body

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.objects.pop(Key, None)


@pytest.fixture
def s3(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(admin_catalog, "s3_client", lambda: fake)
    return fake


@pytest.fixture
async def category(session):
    category = Category(slug="chips", name="Чіпси")
    session.add(category)
    await session.commit()
    return category


def product_body(category, **overrides):
    return {
        "category_id": category.id,
        "slug": "apple",
        "name": "Яблучні чіпси",
        "weight_g": 100,
        "price": "89.50",
        "stock_qty": 10,
        "illustration": "apple",
        "accent_color": "#F7DCD3",
    } | overrides


async def test_create_product_and_status_follows_stock(client, admin, category):
    url = "/api/v1/admin/products"
    created = await client.post(url, json=product_body(category), headers=auth(admin))
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "active"
    assert created.json()["price"] == 89.5

    sold_out = await client.post(
        url, json=product_body(category, slug="pear", stock_qty=0), headers=auth(admin)
    )
    assert sold_out.json()["status"] == "coming_soon"

    hidden = await client.post(
        url, json=product_body(category, slug="draft", visible=False), headers=auth(admin)
    )
    assert hidden.json()["status"] == "hidden"
    assert hidden.json()["visible"] is False


async def test_validation_and_conflicts(client, admin, category):
    url = "/api/v1/admin/products"
    bad = await client.post(
        url,
        json=product_body(category, slug="Not a slug", accent_color="red", weight_g=0),
        headers=auth(admin),
    )
    assert bad.status_code == 422
    assert {e["loc"][-1] for e in bad.json()["detail"]} == {"slug", "accent_color", "weight_g"}

    await client.post(url, json=product_body(category), headers=auth(admin))
    duplicate = await client.post(url, json=product_body(category), headers=auth(admin))
    assert duplicate.status_code == 409


async def test_update_stock_records_movement_and_restores_sale(client, session, admin, category):
    created = (
        await client.post(
            "/api/v1/admin/products",
            json=product_body(category, stock_qty=0),
            headers=auth(admin),
        )
    ).json()
    assert created["status"] == "coming_soon"

    updated = await client.put(
        f"/api/v1/admin/products/{created['id']}",
        json=product_body(category, stock_qty=25, name="Нова назва"),
        headers=auth(admin),
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "active"  # back on sale automatically
    assert updated.json()["name"] == "Нова назва"

    movement = await session.scalar(select(StockMovement))
    assert (movement.delta, movement.reason, movement.user_id) == (25, "manual", admin.id)


async def test_adjust_stock(client, admin, category):
    product = (
        await client.post(
            "/api/v1/admin/products", json=product_body(category, stock_qty=3), headers=auth(admin)
        )
    ).json()
    url = f"/api/v1/admin/products/{product['id']}/stock"

    response = await client.post(url, json={"delta": -3, "note": "Брак"}, headers=auth(admin))
    assert response.json()["stock_qty"] == 0
    assert response.json()["status"] == "coming_soon"

    too_much = await client.post(url, json={"delta": -1}, headers=auth(admin))
    assert too_much.status_code == 400
    assert (await client.post(url, json={"delta": 0}, headers=auth(admin))).status_code == 422


async def test_images_upload_reorder_delete(client, admin, category, s3):
    product = (
        await client.post(
            "/api/v1/admin/products", json=product_body(category), headers=auth(admin)
        )
    ).json()
    url = f"/api/v1/admin/products/{product['id']}/images"

    for alt in ("Пачка", "Крупно"):
        response = await client.post(
            url, files={"file": ("a.png", PNG, "image/png")}, data={"alt": alt}, headers=auth(admin)
        )
        assert response.status_code == 201, response.text
    images = response.json()["images"]
    assert [i["alt"] for i in images] == ["Пачка", "Крупно"]
    assert all(i["url"].startswith("/media/products/") for i in images)
    assert len(s3.objects) == 2

    ids = [i["id"] for i in images]
    reordered = await client.put(
        f"{url}/order", json={"ids": list(reversed(ids))}, headers=auth(admin)
    )
    assert [i["alt"] for i in reordered.json()["images"]] == ["Крупно", "Пачка"]

    deleted = await client.delete(f"{url}/{ids[0]}", headers=auth(admin))
    assert [i["alt"] for i in deleted.json()["images"]] == ["Крупно"]
    assert len(s3.objects) == 1

    public = (await client.get("/api/v1/products/apple")).json()
    assert public["image"]["alt"] == "Крупно"


async def test_upload_rejects_non_images(client, admin, category, s3):
    product = (
        await client.post(
            "/api/v1/admin/products", json=product_body(category), headers=auth(admin)
        )
    ).json()
    response = await client.post(
        f"/api/v1/admin/products/{product['id']}/images",
        files={"file": ("x.png", b"<script>alert(1)</script>", "image/png")},
        headers=auth(admin),
    )
    assert response.status_code == 415
    assert s3.objects == {}


async def test_categories_crud(client, session, admin, category):
    url = "/api/v1/admin/categories"
    created = await client.post(
        url,
        json={"slug": "pastila", "name": "Пастила", "status": "coming_soon", "sort_order": 5},
        headers=auth(admin),
    )
    assert created.status_code == 201
    listed = (await client.get(url, headers=auth(admin))).json()
    assert [c["slug"] for c in listed] == ["chips", "pastila"]

    session.add(Product(category_id=category.id, slug="x", name="x", weight_g=1, price=Decimal(1)))
    await session.commit()
    blocked = await client.delete(f"{url}/{category.id}", headers=auth(admin))
    assert blocked.status_code == 409
    removed = await client.delete(f"{url}/{created.json()['id']}", headers=auth(admin))
    assert removed.status_code == 204


async def test_delete_product(client, session, admin, category, s3):
    product = (
        await client.post(
            "/api/v1/admin/products", json=product_body(category), headers=auth(admin)
        )
    ).json()
    await client.post(
        f"/api/v1/admin/products/{product['id']}/images",
        files={"file": ("a.png", PNG, "image/png")},
        headers=auth(admin),
    )
    response = await client.delete(f"/api/v1/admin/products/{product['id']}", headers=auth(admin))
    assert response.status_code == 204
    assert await session.scalar(select(Product)) is None
    assert s3.objects == {}
