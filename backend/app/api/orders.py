from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ratelimit import RateLimiter
from app.db.session import get_session
from app.schemas.catalog import ProductCard
from app.schemas.orders import (
    CartValidateRequest,
    OrderCreate,
    OrderCreated,
    OrderItemOut,
    OutOfStockResponse,
)
from app.services import catalog, orders

router = APIRouter(tags=["orders"])

Session = Annotated[AsyncSession, Depends(get_session)]

order_rate_limit = RateLimiter(limit=5, window_seconds=600)


@router.post("/cart/validate")
async def validate_cart(body: CartValidateRequest, session: Session) -> list[ProductCard]:
    """Current price and availability for products in a stored cart.

    Products that are no longer sold are omitted — the client drops them.
    """
    products = await catalog.get_products_by_slugs(session, body.slugs)
    return [catalog.to_card(p) for p in products]


@router.post(
    "/orders",
    status_code=status.HTTP_201_CREATED,
    response_model=OrderCreated,
    dependencies=[Depends(order_rate_limit)],
    responses={409: {"model": OutOfStockResponse, "description": "Some items are unavailable"}},
)
async def create_order(body: OrderCreate, session: Session) -> OrderCreated | JSONResponse:
    if body.website:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Некоректний запит")
    try:
        order = await orders.create_order(session, body)
    except orders.OutOfStockError as exc:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=OutOfStockResponse(
                detail="Деяких товарів немає в потрібній кількості", items=exc.items
            ).model_dump(),
        )
    return OrderCreated(
        number=order.number,
        items_total=order.items_total,
        payment_method=order.payment_method,
        items=[
            OrderItemOut(
                name=i.product_name,
                weight_g=i.weight_g,
                unit_price=i.unit_price,
                qty=i.qty,
                line_total=i.line_total,
            )
            for i in order.items
        ],
    )
