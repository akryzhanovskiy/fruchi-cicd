from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.deps import AdminOnly, Session
from app.core.security import hash_password
from app.models import AdminUser, UserRole
from app.schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["admin: users"])


@router.get("")
async def list_users(session: Session, _: AdminOnly) -> list[UserOut]:
    users = await session.scalars(select(AdminUser).order_by(AdminUser.name))
    return [UserOut.model_validate(u) for u in users]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, session: Session, _: AdminOnly) -> UserOut:
    user = AdminUser(
        email=body.email.lower(),
        name=body.name,
        role=body.role,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "Користувач з таким email уже є") from exc
    return UserOut.model_validate(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: int, body: UserUpdate, session: Session, current: AdminOnly
) -> UserOut:
    user = await session.get(AdminUser, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Користувача не знайдено")
    if user.id == current.id and (
        body.is_active is False or (body.role is not None and body.role != UserRole.ADMIN)
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Не можна вимкнути себе або зняти з себе роль адміністратора",
        )
    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None and body.is_active != user.is_active:
        user.is_active = body.is_active
        user.token_version += 1  # signs the user out everywhere
    if body.password is not None:
        user.password_hash = hash_password(body.password)
        user.token_version += 1
    await session.commit()
    return UserOut.model_validate(user)
