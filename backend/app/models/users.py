import enum
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, str_enum


class UserRole(enum.StrEnum):
    ADMIN = "admin"  # everything, including users and settings
    OPERATOR = "operator"  # orders, products, categories


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(str_enum(UserRole), default=UserRole.OPERATOR)
    is_active: Mapped[bool] = mapped_column(default=True)
    # Bumped on password change / deactivation: invalidates issued refresh tokens.
    token_version: Mapped[int] = mapped_column(default=0)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Setting(TimestampMixin, Base):
    """Key-value shop settings edited in the admin panel."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
