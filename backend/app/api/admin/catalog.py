from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, Session
from app.models import CatalogStatus, Category, Product, ProductImage, StockReason
from app.schemas.admin_catalog import (
    CategoryAdmin,
    CategoryIn,
    ImageOrder,
    ImageUpdate,
    ProductAdmin,
    ProductIn,
    StockAdjust,
)
from app.services import admin_catalog as svc
from app.services.stock import change_stock

router = APIRouter(tags=["admin: catalog"])


def _conflict(exc: IntegrityError) -> HTTPException:
    text = str(exc.orig)
    if "slug" in text:
        return HTTPException(status.HTTP_409_CONFLICT, "Такий slug уже використовується")
    if "sku" in text:
        return HTTPException(status.HTTP_409_CONFLICT, "Такий артикул уже використовується")
    if "category_id" in text:
        return HTTPException(status.HTTP_409_CONFLICT, "Категорію не знайдено")
    return HTTPException(status.HTTP_409_CONFLICT, "Конфлікт даних")


# --- Categories ---


@router.get("/categories")
async def list_categories(session: Session, _: CurrentUser) -> list[CategoryAdmin]:
    return await svc.list_categories(session)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryIn, session: Session, _: CurrentUser) -> CategoryAdmin:
    category = Category(**body.model_dump())
    session.add(category)
    try:
        await session.commit()
    except IntegrityError as exc:
        raise _conflict(exc) from exc
    return CategoryAdmin(**body.model_dump(), id=category.id, product_count=0)


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int, body: CategoryIn, session: Session, _: CurrentUser
) -> CategoryAdmin:
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категорію не знайдено")
    for field, value in body.model_dump().items():
        setattr(category, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        raise _conflict(exc) from exc
    return next(c for c in await svc.list_categories(session) if c.id == category_id)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, session: Session, _: CurrentUser) -> None:
    category = await session.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категорію не знайдено")
    await session.delete(category)
    try:
        await session.commit()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "У категорії є товари — спершу перенесіть або видаліть їх"
        ) from exc


# --- Products ---


async def _product_or_404(session: Session, product_id: int) -> Product:
    product = await svc.get_product(session, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не знайдено")
    return product


@router.get("/products")
async def list_products(
    session: Session,
    _: CurrentUser,
    q: str | None = None,
    category_id: int | None = None,
    status_: Annotated[CatalogStatus | None, Query(alias="status")] = None,
) -> list[ProductAdmin]:
    products = await svc.list_products(session, q=q, category_id=category_id, status=status_)
    return [svc.to_admin(p) for p in products]


@router.get("/products/{product_id}")
async def get_product(product_id: int, session: Session, _: CurrentUser) -> ProductAdmin:
    return svc.to_admin(await _product_or_404(session, product_id))


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductIn, session: Session, user: CurrentUser) -> ProductAdmin:
    try:
        product = await svc.create_product(session, body, user)
    except IntegrityError as exc:
        raise _conflict(exc) from exc
    return svc.to_admin(product)


@router.put("/products/{product_id}")
async def update_product(
    product_id: int, body: ProductIn, session: Session, user: CurrentUser
) -> ProductAdmin:
    product = await _product_or_404(session, product_id)
    try:
        product = await svc.update_product(session, product, body, user)
    except IntegrityError as exc:
        raise _conflict(exc) from exc
    return svc.to_admin(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: int, session: Session, _: CurrentUser) -> None:
    await svc.delete_product(session, await _product_or_404(session, product_id))


@router.post("/products/{product_id}/stock")
async def adjust_stock(
    product_id: int, body: StockAdjust, session: Session, user: CurrentUser
) -> ProductAdmin:
    product = await _product_or_404(session, product_id)
    try:
        movement = change_stock(
            product, body.delta, StockReason.MANUAL, user_id=user.id, note=body.note
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Залишок не може бути від’ємним") from exc
    session.add(movement)
    await session.commit()
    return svc.to_admin(await _product_or_404(session, product_id))


# --- Product images ---


@router.post("/products/{product_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_image(
    product_id: int,
    session: Session,
    _: CurrentUser,
    file: Annotated[UploadFile, File()],
    alt: Annotated[str, Form(max_length=300)] = "",
) -> ProductAdmin:
    product = await _product_or_404(session, product_id)
    data = await file.read(svc.MAX_IMAGE_BYTES + 1)
    if len(data) > svc.MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "Фото більше за 10 МБ")
    try:
        await svc.add_image(session, product, data, alt.strip())
    except ValueError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc
    session.expire_all()
    return svc.to_admin(await _product_or_404(session, product_id))


async def _image_or_404(session: Session, product_id: int, image_id: int) -> ProductImage:
    image = await session.get(ProductImage, image_id)
    if image is None or image.product_id != product_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Фото не знайдено")
    return image


@router.patch("/products/{product_id}/images/{image_id}")
async def update_image(
    product_id: int, image_id: int, body: ImageUpdate, session: Session, _: CurrentUser
) -> ProductAdmin:
    image = await _image_or_404(session, product_id, image_id)
    image.alt = body.alt
    await session.commit()
    return svc.to_admin(await _product_or_404(session, product_id))


@router.delete("/products/{product_id}/images/{image_id}")
async def delete_image(
    product_id: int, image_id: int, session: Session, _: CurrentUser
) -> ProductAdmin:
    await svc.delete_image(session, await _image_or_404(session, product_id, image_id))
    session.expire_all()
    return svc.to_admin(await _product_or_404(session, product_id))


@router.put("/products/{product_id}/images/order")
async def reorder_images(
    product_id: int, body: ImageOrder, session: Session, _: CurrentUser
) -> ProductAdmin:
    product = await _product_or_404(session, product_id)
    try:
        await svc.reorder_images(session, product, body.ids)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    session.expire_all()
    return svc.to_admin(await _product_or_404(session, product_id))
