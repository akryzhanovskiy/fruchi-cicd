from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status

from app.api.deps import CurrentUser, Session
from app.core.config import get_settings
from app.core.ratelimit import RateLimiter
from app.core.security import create_token, decode_token, verify_password
from app.models import AdminUser
from app.schemas.users import LoginRequest, TokenResponse, UserOut
from app.services import users

router = APIRouter(prefix="/auth", tags=["admin: auth"])

REFRESH_COOKIE = "fruchi_refresh"
COOKIE_PATH = "/api/v1/admin/auth"

login_rate_limit = RateLimiter(limit=10, window_seconds=300)


def _issue_tokens(response: Response, user: AdminUser) -> TokenResponse:
    """Access token goes to the client (kept in memory); refresh token — httpOnly cookie."""
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        create_token(user.id, "refresh", ver=user.token_version),
        max_age=settings.refresh_token_days * 86400,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
    )
    return TokenResponse(
        access_token=create_token(user.id, "access", role=user.role.value),
        user=UserOut.model_validate(user),
    )


@router.post("/login", dependencies=[Depends(login_rate_limit)])
async def login(body: LoginRequest, response: Response, session: Session) -> TokenResponse:
    user = await users.get_by_email(session, body.email)
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невірний email або пароль")
    user.last_login_at = datetime.now(UTC)
    await session.commit()
    return _issue_tokens(response, user)


@router.post("/refresh")
async def refresh(
    response: Response,
    session: Session,
    fruchi_refresh: str | None = Cookie(default=None),
) -> TokenResponse:
    payload = decode_token(fruchi_refresh, "refresh") if fruchi_refresh else None
    user = await session.get(AdminUser, int(payload["sub"])) if payload else None
    if (
        payload is None
        or user is None
        or not user.is_active
        or payload.get("ver") != user.token_version
    ):
        response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Сесія завершилась, увійдіть знову")
    return _issue_tokens(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
