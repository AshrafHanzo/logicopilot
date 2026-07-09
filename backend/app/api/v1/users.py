from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import TenantScope, get_current_user, get_db, get_tenant_scope, require_role, scoped_query
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import OPERATOR, SUPER_ADMIN, TENANT_ADMIN, User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    creator: User = Depends(require_role(SUPER_ADMIN, TENANT_ADMIN)),
) -> UserOut:
    """Enforces the creation hierarchy: Super Admin -> Tenant Admin, Tenant Admin -> Operator.
    Operators are blocked from this endpoint entirely by require_role above."""
    if creator.role == SUPER_ADMIN:
        if payload.role != TENANT_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super admins may only create tenant_admin accounts here",
            )
        if not payload.tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id is required")
        tenant = db.get(Tenant, payload.tenant_id)
        if tenant is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        tenant_id = tenant.id
    else:  # TENANT_ADMIN
        if payload.role != OPERATOR:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant admins may only create operator accounts",
            )
        # Force the creator's own tenant regardless of what the caller passed — never trust
        # a tenant_id supplied by a non-super-admin caller.
        tenant_id = creator.tenant_id

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        tenant_id=tenant_id,
        created_by_id=creator.id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), scope: TenantScope = Depends(get_tenant_scope)) -> list[UserOut]:
    users = scoped_query(db, User, scope).all()
    return [UserOut.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db), scope: TenantScope = Depends(get_tenant_scope)) -> UserOut:
    user = scoped_query(db, User, scope).filter(User.id == user_id).first()
    if user is None:
        # 404, not 403: don't confirm to a caller that a user in another tenant exists.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    actor: User = Depends(require_role(SUPER_ADMIN, TENANT_ADMIN)),
) -> UserOut:
    """Mirrors the creation hierarchy: Super Admin manages tenant_admin accounts,
    Tenant Admin manages operator accounts within their own tenant (enforced by scoped_query)."""
    user = scoped_query(db, User, scope).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own account")

    if actor.role == SUPER_ADMIN and user.role != TENANT_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super admins may only manage tenant_admin accounts here"
        )
    if actor.role == TENANT_ADMIN and user.role != OPERATOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant admins may only manage operator accounts")

    user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
