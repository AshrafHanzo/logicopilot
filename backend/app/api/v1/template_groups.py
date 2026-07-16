from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.models.cross_doc_link import CrossDocLink
from app.models.template_document import TemplateDocument
from app.models.template_group import TemplateGroup
from app.models.tenant import Tenant
from app.models.user import SUPER_ADMIN, TENANT_ADMIN, User
from app.schemas.onboarding import (
    CrossDocLinkOut,
    TemplateGroupCreate,
    TemplateGroupDetailOut,
    TemplateGroupOut,
)

router = APIRouter(prefix="/template-groups", tags=["onboarding: groups"])


@router.post("", response_model=TemplateGroupDetailOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: TemplateGroupCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> TemplateGroupDetailOut:
    """Step 1: create the group and one empty document row per declared name."""
    if db.get(Tenant, payload.tenant_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    group = TemplateGroup(tenant_id=payload.tenant_id, name=payload.name, status="draft")
    db.add(group)
    db.flush()  # assign group.id before creating children

    for index, doc in enumerate(payload.documents):
        db.add(
            TemplateDocument(
                tenant_id=payload.tenant_id,
                group_id=group.id,
                name=doc.name,
                doc_type=doc.doc_type,
                order_index=index,
            )
        )
    db.commit()
    db.refresh(group)
    return TemplateGroupDetailOut.model_validate(group)


@router.get("", response_model=list[TemplateGroupOut])
def list_groups(
    tenant_id: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> list[TemplateGroupOut]:
    query = db.query(TemplateGroup)
    if tenant_id:
        query = query.filter(TemplateGroup.tenant_id == tenant_id)
    groups = query.order_by(TemplateGroup.created_at.desc()).all()
    return [TemplateGroupOut.model_validate(g) for g in groups]


@router.get("/{group_id}", response_model=TemplateGroupDetailOut)
def get_group(
    group_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(SUPER_ADMIN, TENANT_ADMIN)),
) -> TemplateGroupDetailOut:
    """Full template state: documents + their marks + cross-doc links.
    Super admins see any; tenant admins only their own tenant's."""
    group = db.get(TemplateGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template group not found")
    if user.role == TENANT_ADMIN and group.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template group not found")

    detail = TemplateGroupDetailOut.model_validate(group)
    links = db.query(CrossDocLink).filter(CrossDocLink.group_id == group_id).all()
    detail.cross_doc_links = [CrossDocLinkOut.model_validate(c) for c in links]
    return detail


@router.post("/{group_id}/finalize", response_model=TemplateGroupOut)
def finalize_group(
    group_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> TemplateGroupOut:
    """Mark the template set ready — this is what makes it runnable as a Job."""
    group = db.get(TemplateGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template group not found")
    group.status = "ready"
    db.commit()
    db.refresh(group)
    return TemplateGroupOut.model_validate(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> None:
    group = db.get(TemplateGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template group not found")

    # Clean up everything tied to this template (SQLite FK cascade isn't enforced by
    # default, so remove dependents explicitly to avoid orphans).
    p = {"g": group_id}
    db.execute(text("DELETE FROM job_field_values WHERE job_id IN (SELECT id FROM jobs WHERE group_id=:g)"), p)
    db.execute(text("DELETE FROM job_documents WHERE job_id IN (SELECT id FROM jobs WHERE group_id=:g)"), p)
    db.execute(text("DELETE FROM jobs WHERE group_id=:g"), p)
    db.execute(text("DELETE FROM cross_doc_links WHERE group_id=:g"), p)
    db.execute(text("DELETE FROM user_template_assignments WHERE group_id=:g"), p)
    db.execute(text("DELETE FROM template_reviews WHERE group_id=:g"), p)
    db.delete(group)  # ORM cascade removes its documents -> field marks
    db.commit()
