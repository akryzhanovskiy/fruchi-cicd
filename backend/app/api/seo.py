"""Crawler-facing endpoints. nginx serves them on the storefront domain:
/sitemap.xml, /feed/google.xml and every page URL (/api/v1/page/<path>)."""

import logging
from xml.sax.saxutils import escape

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import HTMLResponse

from app.api.deps import Session
from app.core.config import get_settings
from app.services import catalog, feed, pages

logger = logging.getLogger(__name__)

router = APIRouter(tags=["seo"])

STATIC_PAGES = ["/", *pages.STATIC_PAGES]


@router.get("/sitemap.xml", response_class=Response)
async def sitemap(session: Session) -> Response:
    base = get_settings().site_url.rstrip("/")
    urls: list[tuple[str, str | None]] = [(path, None) for path in STATIC_PAGES]
    for category in await catalog.list_categories(session):
        urls.append((f"/catalog/{category.slug}", category.updated_at.date().isoformat()))
    for product in await catalog.list_products(session, None):
        urls.append((f"/product/{product.slug}", product.updated_at.date().isoformat()))

    entries = "".join(
        f"<url><loc>{escape(base + path)}</loc>"
        + (f"<lastmod>{lastmod}</lastmod>" if lastmod else "")
        + "</url>"
        for path, lastmod in urls
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{entries}</urlset>'
    )
    return Response(xml, media_type="application/xml")


@router.get("/feed/google.xml", response_class=Response)
async def google_feed(session: Session) -> Response:
    return Response(await feed.google_feed(session), media_type="application/xml")


@router.get("/page/{path:path}", response_class=HTMLResponse, include_in_schema=False)
async def page(path: str, session: Session) -> HTMLResponse:
    """Storefront page with its meta tags and content filled in (see services/pages.py)."""
    try:
        code, body = await pages.render_page(session, path)
    except pages.TemplateUnavailableError as exc:
        # 503 makes nginx serve the plain index.html instead.
        logger.warning("Storefront template unavailable: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Template unavailable") from exc
    headers = {"Cache-Control": "no-cache"}
    if code == status.HTTP_404_NOT_FOUND:
        headers["X-Robots-Tag"] = "noindex"
    return HTMLResponse(body, status_code=code, headers=headers)
