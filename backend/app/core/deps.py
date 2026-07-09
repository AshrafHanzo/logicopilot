from dataclasses import dataclass
from typing import Generator, Type, TypeVar

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Query, Session

from app.core.security import TokenType, decode_token
from app.db.session import SessionLocal
from app.models.user import SUPER_ADMIN, User

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"

ModelT = TypeVar("ModelT")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("type") != TokenType.ACCESS.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


def require_role(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return dependency


@dataclass
class TenantScope:
    tenant_id: str | None
    is_super_admin: bool


def get_tenant_scope(
    user: User = Depends(get_current_user),
    tenant_id: str | None = None,
) -> TenantScope:
    """Super admins are unrestricted (optionally narrowed via ?tenant_id=); everyone else is
    forced to their own tenant regardless of what's passed in."""
    if user.role == SUPER_ADMIN:
        return TenantScope(tenant_id=tenant_id, is_super_admin=True)
    return TenantScope(tenant_id=user.tenant_id, is_super_admin=False)


def scoped_query(db: Session, model: Type[ModelT], scope: TenantScope) -> Query:
    """The single tenant-filtering choke point — every tenant-scoped route must go through
    this instead of hand-written `.filter(tenant_id==...)` so isolation can't be forgotten."""
    query = db.query(model)
    if scope.tenant_id is not None:
        query = query.filter(model.tenant_id == scope.tenant_id)
    return query
