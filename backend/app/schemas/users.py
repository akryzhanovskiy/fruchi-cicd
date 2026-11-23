from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

from app.models.users import UserRole

Password = Annotated[str, StringConstraints(min_length=8, max_length=200)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole
    is_active: bool
    last_login_at: datetime | None


class LoginRequest(BaseModel):
    # Plain strings: a malformed email is just a failed login (401), not a validation error.
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
    password: Annotated[str, StringConstraints(max_length=200)]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth2 token kind
    user: UserOut


class UserCreate(BaseModel):
    email: EmailStr
    name: Name
    password: Password
    role: UserRole = UserRole.OPERATOR


class UserUpdate(BaseModel):
    name: Name | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: Password | None = None
