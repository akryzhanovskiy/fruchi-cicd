"""Texts of operator notifications (Telegram HTML)."""

from decimal import Decimal
from html import escape

from app.core.config import get_settings
from app.models import Order, PaymentMethod, PaymentStatus

PAYMENT_METHOD = {
    PaymentMethod.COD: "при отриманні (накладений платіж)",
    PaymentMethod.CARD_TRANSFER: "на картку",
}
PAYMENT_STATUS = {
    PaymentStatus.NOT_REQUIRED: "",
    PaymentStatus.AWAITING: " — очікує оплати, надішліть реквізити",
    PaymentStatus.PAID: " — оплачено",
}


def money(value: Decimal) -> str:
    """1234.5 -> '1 234,50 грн', 89 -> '89 грн'."""
    q = value.quantize(Decimal("0.01"))
    whole, frac = f"{q:,.2f}".replace(",", " ").split(".")
    return f"{whole} грн" if frac == "00" else f"{whole},{frac} грн"


def admin_link(path: str) -> str:
    return get_settings().admin_public_url.rstrip("/") + path


def order_created(order: Order) -> str:
    lines = [
        f"🛒 <b>Нове замовлення {escape(order.number)}</b>",
        f"💰 <b>{money(order.items_total)}</b>",
        "",
    ]
    for item in order.items:
        lines.append(
            f"• {escape(item.product_name)}, {item.weight_g} г × {item.qty}"
            f" = {money(item.line_total)}"
        )
    lines += [
        "",
        f"👤 {escape(order.customer_name)}, {escape(order.phone)}",
        f"📍 {escape(order.city)}, {escape(order.np_branch)}",
        f"💳 Оплата {PAYMENT_METHOD[order.payment_method]}{PAYMENT_STATUS[order.payment_status]}",
    ]
    if order.customer_comment:
        lines.append(f"💬 {escape(order.customer_comment)}")
    # A plain URL rather than <a href>: Telegram rejects links to hosts like `localhost`.
    lines += ["", f"Відкрити в адмінці: {escape(admin_link(f'/orders/{order.id}'))}"]
    return "\n".join(lines)


def product_sold_out(product_id: int, name: str) -> str:
    return "\n".join(
        [
            f"📦 <b>Товар закінчився:</b> {escape(name)}",
            "На вітрині він позначений «Скінчився». Поповніть залишок в адмінці:",
            escape(admin_link(f"/products/{product_id}")),
        ]
    )


def test_message() -> str:
    return "✅ Тестове повідомлення Fruchi: сповіщення про замовлення надходитимуть у цей чат."
