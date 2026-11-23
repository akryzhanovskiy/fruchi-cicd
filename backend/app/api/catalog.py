from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.catalog import CategoryOut, ProductCard, ProductDetail
from app.services import catalog

router = APIRouter(tags=["catalog"])

Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/categories")
async def list_categories(session: Session) -> list[CategoryOut]:
    categories = await catalog.list_categories(session)
    return [catalog.to_category(c) for c in categories]


@router.get("/products")
async def list_products(session: Session, category: str | None = None) -> list[ProductCard]:
    products = await catalog.list_products(session, category)
    return [catalog.to_card(p) for p in products]


@router.get("/products/{slug}")
async def get_product(slug: str, session: Session) -> ProductDetail:
    product = await catalog.get_product(session, slug)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Товар не знайдено")
    return catalog.to_detail(product)
