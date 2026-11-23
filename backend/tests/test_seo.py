from decimal import Decimal

from app.models import CatalogStatus, Category, Product


async def test_sitemap_lists_pages_and_visible_catalog(client, session):
    chips = Category(slug="chips", name="Чіпси")
    session.add_all(
        [
            Product(slug="apple", name="Яблучні", category=chips, weight_g=100, price=Decimal(89)),
            Product(
                slug="secret",
                name="Прихований",
                category=chips,
                weight_g=100,
                price=Decimal(89),
                status=CatalogStatus.HIDDEN,
            ),
            Category(slug="draft", name="Чернетка", status=CatalogStatus.HIDDEN),
        ]
    )
    await session.commit()

    response = await client.get("/api/v1/sitemap.xml")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    xml = response.text
    for path in ["/", "/delivery", "/offer", "/privacy", "/catalog/chips", "/product/apple"]:
        assert f"<loc>https://fruchi.com.ua{path}</loc>" in xml
    assert "secret" not in xml
    assert "draft" not in xml
