import asyncio
import json
from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.api.admin import orders as orders_api
from app.api.admin import settings as settings_api
from app.core.config import get_settings
from app.models import Category, NotificationOutbox, OutboxStatus, Product, Setting
from app.notifications import messages
from app.notifications.live import order_events
from app.notifications.outbox import MAX_ATTEMPTS, process_batch
from tests.conftest import auth

ORDER = {
    "customer_name": "Олена <Петренко>",
    "phone": "0671234567",
    "city": "Київ",
    "np_branch": "Відділення 12",
    "payment_method": "card_transfer",
    "comment": "Подзвоніть & напишіть",
    "items": [{"slug": "apple", "qty": 2}],
}


@pytest.fixture
async def product(session):
    product = Product(
        slug="apple",
        name="Яблучні чіпси",
        category=Category(slug="chips", name="Чіпси"),
        weight_g=100,
        price=Decimal("89.50"),
        stock_qty=2,
    )
    session.add(product)
    await session.commit()
    return product


@pytest.fixture
def bot(monkeypatch):
    monkeypatch.setattr(get_settings(), "telegram_bot_token", "123:TEST")
    monkeypatch.setattr(get_settings(), "admin_public_url", "http://admin.test/")


@pytest.fixture
async def chat(session):
    session.add(Setting(key="telegram_chat_id", value="303149141"))
    await session.commit()


class FakeTelegram:
    def __init__(self, status=200, body=None):
        self.status = status
        self.body = body or {"ok": True}
        self.sent: list[dict] = []

    def client(self) -> httpx.AsyncClient:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/bot123:TEST/sendMessage"
            self.sent.append(json.loads(request.content))
            return httpx.Response(self.status, json=self.body)

        return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def outbox(session):
    session.expire_all()
    return list(await session.scalars(select(NotificationOutbox).order_by(NotificationOutbox.id)))


def test_money():
    assert messages.money(Decimal("89")) == "89 грн"
    assert messages.money(Decimal("1234.5")) == "1 234,50 грн"


async def test_order_delivered_to_telegram(client, session, product, bot, chat):
    assert (await client.post("/api/v1/orders", json=ORDER)).status_code == 201
    fake = FakeTelegram()
    async with fake.client() as http:
        assert await process_batch(session, http) == 2  # order + "sold out"

    order_msg, sold_out_msg = fake.sent
    assert order_msg["chat_id"] == "303149141"
    assert order_msg["parse_mode"] == "HTML"
    text = order_msg["text"]
    assert "Нове замовлення FR-" in text
    assert "Яблучні чіпси, 100 г × 2 = 179 грн" in text
    assert "Олена &lt;Петренко&gt;, +380671234567" in text  # user input is escaped
    assert "Подзвоніть &amp; напишіть" in text
    assert "на картку — очікує оплати" in text
    assert "http://admin.test/orders/1" in text
    assert "Товар закінчився" in sold_out_msg["text"]
    assert f"http://admin.test/products/{product.id}" in sold_out_msg["text"]

    rows = await outbox(session)
    assert [r.status for r in rows] == [OutboxStatus.SENT, OutboxStatus.SENT]
    assert rows[0].sent_at is not None
    async with fake.client() as http:
        assert await process_batch(session, http) == 0  # nothing is sent twice


async def test_temporary_error_is_retried_with_backoff(client, session, product, bot, chat):
    await client.post("/api/v1/orders", json=ORDER)
    fake = FakeTelegram(status=502, body={"ok": False, "description": "Bad Gateway"})
    async with fake.client() as http:
        await process_batch(session, http)
        row = (await outbox(session))[0]
        assert row.status == OutboxStatus.PENDING
        assert row.attempts == 1
        assert row.next_attempt_at > datetime.now(UTC)
        assert row.last_error == "Telegram: Bad Gateway"
        # Not due yet — the next pass skips it.
        assert await process_batch(session, http) == 0

        # Out of attempts -> failed.
        for row in await outbox(session):
            row.attempts = MAX_ATTEMPTS - 1
            row.next_attempt_at = datetime.now(UTC)
        await session.commit()
        await process_batch(session, http)
    assert {r.status for r in await outbox(session)} == {OutboxStatus.FAILED}


async def test_permanent_error_fails_at_once(client, session, product, bot, chat):
    await client.post("/api/v1/orders", json=ORDER)
    fake = FakeTelegram(
        status=400, body={"ok": False, "description": "Bad Request: chat not found"}
    )
    async with fake.client() as http:
        await process_batch(session, http)
    row = (await outbox(session))[0]
    assert row.status == OutboxStatus.FAILED
    assert row.attempts == 1
    assert "chat not found" in (row.last_error or "")


async def test_not_configured_waits_without_spending_attempts(client, session, product, chat):
    await client.post("/api/v1/orders", json=ORDER)  # no bot token
    fake = FakeTelegram()
    async with fake.client() as http:
        await process_batch(session, http)
    row = (await outbox(session))[0]
    assert fake.sent == []
    assert row.status == OutboxStatus.PENDING
    assert row.attempts == 0
    assert row.next_attempt_at > datetime.now(UTC)


async def test_settings_show_bot_status(client, admin, bot):
    body = (await client.get("/api/v1/admin/settings", headers=auth(admin))).json()
    assert body["telegram_bot_configured"] is True


async def test_telegram_test_message(client, admin, operator, chat, bot, monkeypatch):
    sent = []

    async def fake_send(chat_id, text, **_):
        sent.append(chat_id)

    monkeypatch.setattr(settings_api, "send_message", fake_send)
    url = "/api/v1/admin/settings/telegram/test"
    assert (await client.post(url, json={}, headers=auth(admin))).status_code == 204
    assert (await client.post(url, json={"chat_id": "42"}, headers=auth(admin))).status_code == 204
    assert sent == ["303149141", "42"]
    assert (await client.post(url, json={}, headers=auth(operator))).status_code == 403


async def test_telegram_test_without_token(client, admin, chat):
    url = "/api/v1/admin/settings/telegram/test"
    response = await client.post(url, json={}, headers=auth(admin))
    assert response.status_code == 400
    assert "TELEGRAM_BOT_TOKEN" in response.json()["detail"]


async def test_stream_requires_auth(client):
    assert (await client.get("/api/v1/admin/orders/stream")).status_code == 401


async def test_stream_delivers_order_events(client, admin, product, monkeypatch):
    monkeypatch.setattr(orders_api, "STREAM_MAX_SECONDS", 1.5)
    stream = asyncio.create_task(client.get("/api/v1/admin/orders/stream", headers=auth(admin)))
    for _ in range(50):
        if order_events.connected.is_set():
            break
        await asyncio.sleep(0.05)
    assert order_events.connected.is_set()

    created = (await client.post("/api/v1/orders", json=ORDER)).json()
    order_id = (await client.get("/api/v1/admin/orders", headers=auth(admin))).json()["items"][0][
        "id"
    ]
    await client.patch(
        f"/api/v1/admin/orders/{order_id}", json={"operator_note": "ok"}, headers=auth(admin)
    )

    response = await stream
    assert response.headers["content-type"].startswith("text/event-stream")
    events = [
        (block.split("\n")[0], json.loads(block.split("data: ")[1]))
        for block in response.text.split("\n\n")
        if block.startswith("event: order_")
    ]
    assert events == [
        (
            "event: order_created",
            {"type": "order_created", "id": order_id, "number": created["number"]},
        ),
        (
            "event: order_updated",
            {"type": "order_updated", "id": order_id, "number": created["number"]},
        ),
    ]
