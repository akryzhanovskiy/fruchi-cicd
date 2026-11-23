from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()
ALGORITHM = "HS256"

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_token(user_id: int, token_type: TokenType, **claims: Any) -> str:
    settings = get_settings()
    lifetime = (
        timedelta(minutes=settings.access_token_minutes)
        if token_type == "access"  # noqa: S105 - token kind, not a secret
        else timedelta(days=settings.refresh_token_days)
    )
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload | claims, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str, token_type: TokenType) -> dict[str, Any] | None:
    """Returns the payload, or None if the token is invalid, expired or of another type."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token, get_settings().jwt_secret, algorithms=[ALGORITHM]
        )
    except jwt.PyJWTError:
        return None
    return payload if payload.get("type") == token_type else None
