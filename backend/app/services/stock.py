from app.models import CatalogStatus, Product, StockMovement, StockReason


def sync_status(product: Product, visible: bool | None = None) -> None:
    """Visible products are `active` while in stock and `coming_soon` ("Скінчився") at zero.

    `visible=None` keeps the current visibility; hidden products stay hidden.
    """
    if visible is None:
        visible = product.status != CatalogStatus.HIDDEN
    if not visible:
        product.status = CatalogStatus.HIDDEN
    else:
        product.status = (
            CatalogStatus.ACTIVE if product.stock_qty > 0 else CatalogStatus.COMING_SOON
        )


def change_stock(
    product: Product,
    delta: int,
    reason: StockReason,
    *,
    user_id: int | None = None,
    order_id: int | None = None,
    note: str = "",
) -> StockMovement:
    """Applies a stock delta (never below zero), syncs the status, returns the movement row."""
    if product.stock_qty + delta < 0:
        raise ValueError("Stock can't go below zero")
    product.stock_qty += delta
    sync_status(product)
    return StockMovement(
        product_id=product.id,
        delta=delta,
        reason=reason,
        user_id=user_id,
        order_id=order_id,
        note=note,
    )
