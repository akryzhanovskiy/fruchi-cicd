"""Development seed: one category and the six flavours from the design.

Prices and stock are placeholders — real content is entered through the admin panel.
Runs only on an empty catalog, so it never overwrites data.
"""

import logging
from decimal import Decimal

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models.catalog import CatalogStatus, Category, Illustration, Product

logger = logging.getLogger(__name__)

PRODUCTS = [
    (
        "yabluchni-chipsy",
        "Яблучні чіпси",
        "Тонкі кільця зі шкірочкою. Солодко-кислі, як осіннє яблуко.",
        "Тонкі кільця зі шкірочкою. Солодко-кислі, як осіннє яблуко, і хрумкі до останньої скибки.",
        Illustration.APPLE,
        "#F7DCD3",
        "89",
        50,
    ),
    (
        "grushevi-chipsy",
        "Грушеві чіпси",
        "Ніжні й медові, з легкою зернистістю.",
        "Ніжні й медові скибки груші з легкою зернистістю.",
        Illustration.PEAR,
        "#E8EDC9",
        "95",
        50,
    ),
    (
        "bananovi-chipsy",
        "Бананові чіпси",
        "Солодкі хрусткі монетки замість цукерки.",
        "Солодкі хрусткі монетки — смачна заміна цукерці.",
        Illustration.BANANA,
        "#F8ECC4",
        "85",
        50,
    ),
    (
        "apelsynovi-chipsy",
        "Апельсинові чіпси",
        "Яскраві скибки з кислинкою та ледь гіркуватою шкіркою.",
        "Яскраві скибки апельсина з кислинкою та ледь гіркуватою шкіркою.",
        Illustration.ORANGE,
        "#FBDCC2",
        "99",
        50,
    ),
    (
        "lymonni-chipsy",
        "Лимонні чіпси",
        "Кислі й ароматні. До чаю, у воду чи для декору.",
        "Кислі й ароматні скибки лимона — до чаю, у воду чи для декору.",
        Illustration.LEMON,
        "#F6F0BE",
        "99",
        0,  # demonstrates the "Скінчився" state
    ),
    (
        "ananasovi-chipsy",
        "Ананасові чіпси",
        "Тропічна солодкість у хрусткому кільці.",
        "Тропічна солодкість у хрусткому кільці ананаса.",
        Illustration.PINEAPPLE,
        "#FAE3AE",
        "119",
        50,
    ),
]


async def seed() -> None:
    async with SessionLocal() as session:
        if await session.scalar(select(func.count()).select_from(Category)):
            logger.info("Catalog is not empty, seed skipped")
            return
        category = Category(slug="fruktovi-chipsy", name="Фруктові чіпси", sort_order=1)
        session.add(category)
        for order, (slug, name, short, desc, illustration, color, price, stock) in enumerate(
            PRODUCTS, start=1
        ):
            session.add(
                Product(
                    category=category,
                    slug=slug,
                    name=name,
                    short_desc=short,
                    description=desc,
                    illustration=illustration,
                    accent_color=color,
                    weight_g=100,
                    price=Decimal(price),
                    stock_qty=stock,
                    status=CatalogStatus.ACTIVE if stock else CatalogStatus.COMING_SOON,
                    sort_order=order,
                )
            )
        await session.commit()
        logger.info("Seeded %d products", len(PRODUCTS))
