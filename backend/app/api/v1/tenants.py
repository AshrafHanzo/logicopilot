from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import SUPER_ADMIN, TENANT_ADMIN, User
from app.schemas.tenant import TenantCreate, TenantOut

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    creator: User = Depends(require_role(SUPER_ADMIN)),
) -> TenantOut:
    """Creates the company and, if admin credentials are supplied, its tenant-admin
    login in the same step (atomic — a bad email rolls the whole thing back)."""
    wants_admin = any([payload.admin_full_name, payload.admin_email, payload.admin_password])
    if wants_admin and not all([payload.admin_full_name, payload.admin_email, payload.admin_password]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide admin name, email, and password together (or none).",
        )
    if wants_admin and len(payload.admin_password or "") < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin password must be at least 8 characters.")

    tenant = Tenant(name=payload.name, region=payload.region, currency=payload.currency)
    db.add(tenant)
    try:
        db.flush()  # assign tenant.id; still one transaction with the admin below
        if wants_admin:
            db.add(
                User(
                    email=payload.admin_email,
                    hashed_password=hash_password(payload.admin_password),
                    full_name=payload.admin_full_name,
                    role=TENANT_ADMIN,
                    tenant_id=tenant.id,
                    created_by_id=creator.id,
                )
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tenant with this name, or a user with that admin email, already exists.",
        )
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.get("", response_model=list[TenantOut])
def list_tenants(
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> list[TenantOut]:
    tenants = db.query(Tenant).all()
    return [TenantOut.model_validate(t) for t in tenants]


@router.get("/{tenant_id}", response_model=TenantOut)
def get_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenantOut:
    """Super admins can look up any tenant; everyone else only their own (404 otherwise) —
    this is how a Tenant Admin/Operator dashboard shows its own tenant's name."""
    if user.role != SUPER_ADMIN and user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return TenantOut.model_validate(tenant)
