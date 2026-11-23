import uuid
from collections.abc import Sequence

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import AdminUser, CatalogStatus, Category, Product, ProductImage, StockReason
from app.schemas.admin_catalog import AdminImage, CategoryAdmin, ProductAdmin, ProductIn
from app.services.catalog import image_url
from app.services.stock import change_stock, sync_status
from app.services.storage import s3_client

IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


# --- Categories ---


async def list_categories(session: AsyncSession) -> list[CategoryAdmin]:
    counts = (
        select(Product.category_id, func.count().label("n"))
        .group_by(Product.category_id)
        .subquery()
    )
    rows = await session.execute(
        select(Category, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.category_id == Category.id)
        .order_by(Category.sort_order, Category.name)
    )
    return [
        CategoryAdmin(
            id=c.id,
            slug=c.slug,
            name=c.name,
            description=c.description,
            seo_title=c.seo_title,
            seo_description=c.seo_description,
            status=c.status,
            sort_order=c.sort_order,
            product_count=n,
        )
        for c, n in rows.all()
    ]


# --- Products ---


def to_admin(product: Product) -> ProductAdmin:
    return ProductAdmin(
        id=product.id,
        category_id=product.category_id,
        category_name=product.category.name,
        slug=product.slug,
        name=product.name,
        short_desc=product.short_desc,
        description=product.description,
        composition=product.composition,
        nutrition=product.nutrition,
        storage=product.storage,
        seo_title=product.seo_title,
        seo_description=product.seo_description,
        accent_color=product.accent_color,
        illustration=product.illustration,
        weight_g=product.weight_g,
        price=product.price,
        sku=product.sku,
        stock_qty=product.stock_qty,
        status=product.status,
        visible=product.status != CatalogStatus.HIDDEN,
        sort_order=product.sort_order,
        images=[
            AdminImage(id=i.id, url=image_url(i.object_key), alt=i.alt, sort_order=i.sort_order)
            for i in product.images
        ],
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


_with_relations = (selectinload(Product.images), selectinload(Product.category))


async def list_products(
    session: AsyncSession,
    *,
    q: str | None = None,
    category_id: int | None = None,
    status: CatalogStatus | None = None,
) -> Sequence[Product]:
    query = select(Product).options(*_with_relations).order_by(Product.sort_order, Product.name)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                Product.name.ilike(pattern), Product.slug.ilike(pattern), Product.sku.ilike(pattern)
            )
        )
    if category_id:
        query = query.where(Product.category_id == category_id)
    if status:
        query = query.where(Product.status == status)
    return (await session.scalars(query)).all()


async def get_product(session: AsyncSession, product_id: int) -> Product | None:
    return await session.scalar(
        select(Product).where(Product.id == product_id).options(*_with_relations)
    )


def _apply_fields(product: Product, data: ProductIn) -> None:
    for field in data.model_fields_set & set(ProductIn.model_fields) - {"stock_qty", "visible"}:
        setattr(product, field, getattr(data, field))
    product.sku = data.sku or None


async def create_product(session: AsyncSession, data: ProductIn, user: AdminUser) -> Product:
    product = Product(**data.model_dump(exclude={"stock_qty", "visible"}), stock_qty=0)
    product.sku = data.sku or None
    session.add(product)
    await session.flush()
    if data.stock_qty:
        session.add(
            change_stock(
                product, data.stock_qty, StockReason.MANUAL, user_id=user.id, note="Створення"
            )
        )
    sync_status(product, data.visible)
    product_id = product.id
    await session.commit()
    return await get_product(session, product_id)  # type: ignore[return-value]


async def update_product(
    session: AsyncSession, product: Product, data: ProductIn, user: AdminUser
) -> Product:
    _apply_fields(product, data)
    delta = data.stock_qty - product.stock_qty
    if delta:
        session.add(change_stock(product, delta, StockReason.MANUAL, user_id=user.id))
    sync_status(product, data.visible)
    product_id = product.id
    await session.commit()
    session.expire_all()
    return await get_product(session, product_id)  # type: ignore[return-value]


async def delete_product(session: AsyncSession, product: Product) -> None:
    keys = [i.object_key for i in product.images]
    await session.delete(product)
    await session.commit()
    for key in keys:
        await _delete_object(key)


# --- Images ---


def detect_image_type(data: bytes) -> str | None:
    """Content type by magic bytes — don't trust the client's Content-Type alone."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def add_image(session: AsyncSession, product: Product, data: bytes, alt: str) -> None:
    content_type = detect_image_type(data)
    if content_type is None:
        raise ValueError("Підтримуються лише JPEG, PNG або WebP")
    key = f"products/{product.id}/{uuid.uuid4().hex}.{IMAGE_TYPES[content_type]}"
    await run_in_threadpool(
        s3_client().put_object,
        Bucket=get_settings().minio_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    next_order = max((i.sort_order for i in product.images), default=0) + 1
    session.add(ProductImage(product_id=product.id, object_key=key, alt=alt, sort_order=next_order))
    await session.commit()


async def delete_image(session: AsyncSession, image: ProductImage) -> None:
    await session.delete(image)
    await session.commit()
    await _delete_object(image.object_key)


async def reorder_images(session: AsyncSession, product: Product, ids: list[int]) -> None:
    by_id = {i.id: i for i in product.images}
    if sorted(ids) != sorted(by_id):
        raise ValueError("Список фото не збігається з фото товару")
    for order, image_id in enumerate(ids, start=1):
        by_id[image_id].sort_order = order
    await session.commit()


async def _delete_object(key: str) -> None:
    await run_in_threadpool(s3_client().delete_object, Bucket=get_settings().minio_bucket, Key=key)
