"""Test setup: API tests run against a real PostgreSQL in a separate `<db>_test` database.

Locally start it with `make infra`; CI provides a postgres service.
"""

import os

os.environ["POSTGRES_DB"] = os.environ.get("POSTGRES_DB", "fruchi") + "_test"

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.api.admin.auth import login_rate_limit  # noqa: E402
from app.api.orders import order_rate_limit  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.security import create_token, hash_password  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser, Base, UserRole  # noqa: E402


async def _recreate_database() -> None:
    s = get_settings()
    conn = await asyncpg.connect(
        host=s.postgres_host,
        port=s.postgres_port,
        user=s.postgres_user,
        password=s.postgres_password,
        database="postgres",
    )
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{s.postgres_db}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{s.postgres_db}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
async def database():
    await _recreate_database()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def clean_tables(database):
    order_rate_limit.reset()
    login_rate_limit.reset()
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def session():
    async with SessionLocal() as s:
        yield s


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


PASSWORD = "correct-horse-battery"


@pytest.fixture
async def admin(session):
    user = AdminUser(
        email="admin@fruchi.com.ua",
        name="Адмін",
        role=UserRole.ADMIN,
        password_hash=hash_password(PASSWORD),
    )
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def operator(session):
    user = AdminUser(
        email="operator@fruchi.com.ua",
        name="Оператор",
        role=UserRole.OPERATOR,
        password_hash=hash_password(PASSWORD),
    )
    session.add(user)
    await session.commit()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_token(user.id, 'access', role=user.role.value)}"}
