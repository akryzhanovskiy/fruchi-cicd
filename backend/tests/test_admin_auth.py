from app.api.admin.auth import REFRESH_COOKIE
from tests.conftest import PASSWORD, auth


async def login(client, email, password=PASSWORD):
    return await client.post(
        "/api/v1/admin/auth/login", json={"email": email, "password": password}
    )


async def test_login_returns_token_and_sets_refresh_cookie(client, admin):
    response = await login(client, "ADMIN@fruchi.com.ua")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "admin"
    cookie = response.headers["set-cookie"]
    assert REFRESH_COOKIE in cookie and "HttpOnly" in cookie and "SameSite=strict" in cookie

    me = await client.get(
        "/api/v1/admin/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.json()["email"] == "admin@fruchi.com.ua"


async def test_wrong_password_and_inactive_user_are_rejected(client, session, admin):
    assert (await login(client, admin.email, "nope")).status_code == 401
    admin.is_active = False
    await session.commit()
    assert (await login(client, admin.email)).status_code == 401


async def test_protected_endpoints_need_token(client):
    assert (await client.get("/api/v1/admin/orders")).status_code == 401
    bad = {"Authorization": "Bearer garbage"}
    assert (await client.get("/api/v1/admin/orders", headers=bad)).status_code == 401


async def test_refresh_uses_cookie_and_stops_after_password_change(client, admin, session):
    await login(client, admin.email)  # client stores the cookie
    refreshed = await client.post("/api/v1/admin/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]

    admin.token_version += 1  # what a password change does
    await session.commit()
    assert (await client.post("/api/v1/admin/auth/refresh")).status_code == 401


async def test_refresh_without_cookie(client):
    assert (await client.post("/api/v1/admin/auth/refresh")).status_code == 401


async def test_operator_cannot_manage_users_or_settings(client, operator):
    assert (await client.get("/api/v1/admin/users", headers=auth(operator))).status_code == 403
    response = await client.patch(
        "/api/v1/admin/settings", json={"payment_details": "x"}, headers=auth(operator)
    )
    assert response.status_code == 403
    assert (await client.get("/api/v1/admin/settings", headers=auth(operator))).status_code == 200


async def test_set_password_signs_user_out(client, session, admin):
    from app.services.users import set_password

    await login(client, admin.email)
    assert await set_password("Admin@Fruchi.com.ua", "brand-new-password")
    assert not await set_password("nobody@fruchi.com.ua", "brand-new-password")

    assert (await client.post("/api/v1/admin/auth/refresh")).status_code == 401
    assert (await login(client, admin.email)).status_code == 401
    assert (await login(client, admin.email, "brand-new-password")).status_code == 200
