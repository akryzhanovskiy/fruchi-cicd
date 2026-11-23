from collections.abc import Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.catalog import CatalogStatus, Category, Product, ProductImage
from app.schemas.catalog import CategoryOut, ImageOut, ProductCard, ProductDetail
from app.services import meta

MAX_QTY_PER_ITEM = 20

_VISIBLE = (CatalogStatus.ACTIVE, CatalogStatus.COMING_SOON)


def image_url(object_key: str) -> str:
    return f"{get_settings().media_base_url.rstrip('/')}/{object_key}"


def _image_out(image: ProductImage, product: Product) -> ImageOut:
    return ImageOut(url=image_url(image.object_key), alt=image.alt or product.name)


def _card_fields(product: Product) -> dict[str, object]:
    return {
        "slug": product.slug,
        "name": product.name,
        "short_desc": product.short_desc,
        "category": product.category.slug,
        "price": product.price,
        "weight_g": product.weight_g,
        "accent_color": product.accent_color,
        "illustration": product.illustration,
        "image": _image_out(product.images[0], product) if product.images else None,
        "in_stock": product.in_stock,
        "max_qty": min(product.stock_qty, MAX_QTY_PER_ITEM) if product.in_stock else 0,
    }


def to_card(product: Product) -> ProductCard:
    return ProductCard.model_validate(_card_fields(product))


def to_detail(product: Product) -> ProductDetail:
    return ProductDetail.model_validate(
        {
            **_card_fields(product),
            "description": product.description,
            "composition": product.composition,
            "nutrition": product.nutrition,
            "storage": product.storage,
            "images": [_image_out(img, product) for img in product.images],
            "meta_title": meta.product_title(product),
            "meta_description": meta.product_description(product),
        }
    )


def to_category(category: Category) -> CategoryOut:
    return CategoryOut(
        slug=category.slug,
        name=category.name,
        description=category.description,
        meta_title=meta.category_title(category),
        meta_description=meta.category_description(category),
    )


def _visible_products() -> Select[Product]:
    return (
        select(Product)
        .join(Product.category)
        .where(Product.status.in_(_VISIBLE), Category.status.in_(_VISIBLE))
        .options(selectinload(Product.images), selectinload(Product.category))
    )


async def list_categories(session: AsyncSession) -> Sequence[Category]:
    result = await session.scalars(
        select(Category)
        .where(Category.status.in_(_VISIBLE))
        .order_by(Category.sort_order, Category.name)
    )
    return result.all()


async def list_products(session: AsyncSession, category: str | None = None) -> Sequence[Product]:
    query = _visible_products().order_by(Category.sort_order, Product.sort_order, Product.name)
    if category:
        query = query.where(Category.slug == category)
    return (await session.scalars(query)).all()


async def get_product(session: AsyncSession, slug: str) -> Product | None:
    return await session.scalar(_visible_products().where(Product.slug == slug))


async def get_products_by_slugs(session: AsyncSession, slugs: list[str]) -> Sequence[Product]:
    return (await session.scalars(_visible_products().where(Product.slug.in_(slugs)))).all()
