import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import (
    TenantScope,
    get_current_user,
    get_db,
    get_tenant_scope,
    require_role,
    scoped_query,
)
from app.core.docai import get_page_ocr
from app.core.extraction import (
    compare_values,
    extract_document_fields,
    extract_document_fields_from_images,
)
from app.models.cross_doc_link import CrossDocLink
from app.models.field_mark import FieldMark
from app.models.job import Job, JobDocument, JobFieldValue
from app.models.template_document import TemplateDocument
from app.models.template_group import TemplateGroup
from app.models.user import OPERATOR, SUPER_ADMIN, TENANT_ADMIN, User
from app.schemas.jobs import (
    AvailableGroup,
    FieldValueCorrect,
    JobCreate,
    JobDetailOut,
    JobDocumentOut,
    JobFieldValueOut,
    JobOut,
    VerificationDecision,
    VerificationRow,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_BYTES = 25 * 1024 * 1024
RENDER_DPI = 150


def _job_doc_dir(job_document_id: str) -> Path:
    return Path(get_settings().uploads_dir) / "jobs" / job_document_id


def _render_pages(original: Path, pages_dir: Path) -> int:
    import fitz

    pages_dir.mkdir(parents=True, exist_ok=True)
    with fitz.open(original) as doc:
        for index, page in enumerate(doc, start=1):
            page.get_pixmap(dpi=RENDER_DPI).save(pages_dir / f"page_{index}.png")
        return doc.page_count


def _load_job(db: Session, job_id: str, scope: TenantScope) -> Job:
    job = scoped_query(db, Job, scope).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/available-groups", response_model=list[AvailableGroup])
def available_groups(
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    user: User = Depends(require_role(OPERATOR, SUPER_ADMIN, TENANT_ADMIN)),
) -> list[AvailableGroup]:
    """Template sets the caller can act on, scoped by tenant + role:
    - Operator: only tenant-admin-APPROVED sets are runnable.
    - Tenant Admin: sets the super admin finished (ready / approved / changes_requested) to review.
    - Super Admin: any non-draft set (for testing)."""
    if user.role == OPERATOR:
        allowed = ("approved",)
    else:
        allowed = ("ready", "approved", "changes_requested")
    query = scoped_query(db, TemplateGroup, scope).filter(TemplateGroup.status.in_(allowed))

    # If this user has explicit template assignments, restrict to them (super admins
    # are never restricted). No assignments = access all of their tenant's templates.
    if user.role != SUPER_ADMIN:
        from app.models.user_template import UserTemplateAssignment

        assigned = [
            a.group_id
            for a in db.query(UserTemplateAssignment).filter(UserTemplateAssignment.user_id == user.id).all()
        ]
        if assigned:
            query = query.filter(TemplateGroup.id.in_(assigned))

    groups = query.order_by(TemplateGroup.created_at.desc()).all()
    return [AvailableGroup.model_validate(g) for g in groups]


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobOut:
    group = db.get(TemplateGroup, payload.group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template set not found")
    # Operators may only run their own tenant's template sets.
    if user.role == OPERATOR and group.tenant_id != user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template set not found")

    job = Job(
        tenant_id=group.tenant_id,
        group_id=group.id,
        reference=payload.reference,
        status="draft",
        created_by_id=user.id,
    )
    db.add(job)
    db.flush()
    # One empty job-document slot per declared document in the set.
    for tdoc in group.documents:
        db.add(
            JobDocument(
                tenant_id=group.tenant_id,
                job_id=job.id,
                template_document_id=tdoc.id,
            )
        )
    db.commit()
    db.refresh(job)
    return JobOut.model_validate(job)


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN, TENANT_ADMIN)),
) -> list[JobOut]:
    jobs = scoped_query(db, Job, scope).order_by(Job.created_at.desc()).all()
    return [JobOut.model_validate(j) for j in jobs]


def _build_detail(db: Session, job: Job) -> JobDetailOut:
    group = db.get(TemplateGroup, job.group_id)
    tdoc_by_id = {d.id: d for d in group.documents}
    job_docs = db.query(JobDocument).filter(JobDocument.job_id == job.id).all()

    documents = [
        JobDocumentOut(
            id=jd.id,
            template_document_id=jd.template_document_id,
            name=tdoc_by_id[jd.template_document_id].name if jd.template_document_id in tdoc_by_id else "?",
            doc_type=tdoc_by_id[jd.template_document_id].doc_type if jd.template_document_id in tdoc_by_id else "",
            is_uploaded=jd.file_path is not None,
            page_count=jd.page_count,
        )
        for jd in job_docs
    ]

    fvs = db.query(JobFieldValue).filter(JobFieldValue.job_id == job.id).all()
    field_values = [
        JobFieldValueOut(
            id=fv.id,
            mark_id=fv.mark_id,
            template_document_id=fv.template_document_id,
            document_name=tdoc_by_id[fv.template_document_id].name if fv.template_document_id in tdoc_by_id else "?",
            label_name=fv.label_name,
            extracted_value=fv.extracted_value,
            corrected_value=fv.corrected_value,
            value=fv.value,
        )
        for fv in fvs
    ]

    # Cross-verification: compare the value at each link's source vs target mark.
    value_by_mark = {fv.mark_id: fv.value for fv in fvs}
    doc_name_by_mark: dict[str, str] = {}
    for tdoc in group.documents:
        for mark in tdoc.marks:
            doc_name_by_mark[mark.id] = tdoc.name

    accepted_ids = set(job.accepted_verifications or [])
    links = db.query(CrossDocLink).filter(CrossDocLink.group_id == group.id).all()
    verifications: list[VerificationRow] = []
    for link in links:
        src_mark = db.get(FieldMark, link.source_mark_id)
        sv = value_by_mark.get(link.source_mark_id)
        tv = value_by_mark.get(link.target_mark_id)
        verifications.append(
            VerificationRow(
                link_id=link.id,
                field_label=src_mark.label_name if src_mark else "?",
                source_document=doc_name_by_mark.get(link.source_mark_id, "?"),
                source_value=sv,
                target_document=doc_name_by_mark.get(link.target_mark_id, "?"),
                target_value=tv,
                status=compare_values(sv, tv),
                accepted=link.id in accepted_ids,
            )
        )

    # Passes when every row is a clean match, or the operator has accepted it.
    all_passed = len(verifications) > 0 and all(
        v.status == "match" or v.accepted for v in verifications
    )
    return JobDetailOut(
        id=job.id,
        tenant_id=job.tenant_id,
        group_id=job.group_id,
        group_name=group.name,
        reference=job.reference,
        status=job.status,
        documents=documents,
        field_values=field_values,
        verifications=verifications,
        all_checks_passed=all_passed,
    )


@router.get("/jobs/{job_id}", response_model=JobDetailOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN, TENANT_ADMIN)),
) -> JobDetailOut:
    return _build_detail(db, _load_job(db, job_id, scope))


@router.post("/jobs/{job_id}/verification-decision", response_model=JobDetailOut)
def set_verification_decision(
    job_id: str,
    payload: VerificationDecision,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobDetailOut:
    """Operator accepts (or un-accepts) a flagged cross-verification row."""
    job = _load_job(db, job_id, scope)
    accepted = set(job.accepted_verifications or [])
    if payload.accept:
        accepted.add(payload.link_id)
    else:
        accepted.discard(payload.link_id)
    job.accepted_verifications = sorted(accepted)
    db.commit()
    db.refresh(job)
    return _build_detail(db, job)


@router.post("/jobs/{job_id}/complete", response_model=JobDetailOut)
def complete_job(
    job_id: str,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobDetailOut:
    """Operator submits the ERP entry — marks the job completed."""
    job = _load_job(db, job_id, scope)
    if job.status != "extracted":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Run extraction before submitting the entry.")
    job.status = "completed"
    db.commit()
    db.refresh(job)
    return _build_detail(db, job)


@router.post("/jobs/{job_id}/documents/{template_document_id}/upload", response_model=JobDetailOut)
def upload_job_document(
    job_id: str,
    template_document_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobDetailOut:
    job = _load_job(db, job_id, scope)
    jd = (
        db.query(JobDocument)
        .filter(JobDocument.job_id == job.id, JobDocument.template_document_id == template_document_id)
        .first()
    )
    if jd is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job document slot not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail=f"File type not allowed — use one of {sorted(ALLOWED_EXTENSIONS)}")
    if file.size is not None and file.size > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")
    content = file.file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    ddir = _job_doc_dir(jd.id)
    try:
        ddir.mkdir(parents=True, exist_ok=True)
        original = ddir / f"original{ext}"
        original.write_bytes(content)
        page_count = _render_pages(original, ddir / "pages")
    except Exception:  # noqa: BLE001
        logger.exception("Failed to render job document %s", jd.id)
        shutil.rmtree(ddir, ignore_errors=True)
        raise HTTPException(status_code=422, detail="Could not read the uploaded document. Is it a valid PDF or image?")

    jd.file_path = str(original)
    jd.page_count = page_count
    db.commit()
    db.refresh(job)
    return _build_detail(db, job)


@router.post("/jobs/{job_id}/extract", response_model=JobDetailOut)
def extract_job(
    job_id: str,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobDetailOut:
    job = _load_job(db, job_id, scope)
    group = db.get(TemplateGroup, job.group_id)
    job_docs = {jd.template_document_id: jd for jd in db.query(JobDocument).filter(JobDocument.job_id == job.id).all()}

    # Clear any prior run.
    db.query(JobFieldValue).filter(JobFieldValue.job_id == job.id).delete()
    db.flush()

    for tdoc in group.documents:
        jd = job_docs.get(tdoc.id)
        if jd is None or jd.file_path is None or not tdoc.marks:
            continue

        # Concatenate this uploaded document's OCR text across pages.
        text_parts = []
        for page in range(1, jd.page_count + 1):
            try:
                text_parts.append(get_page_ocr(_job_doc_dir(jd.id), page).get("text", ""))
            except Exception:  # noqa: BLE001
                logger.warning("OCR unavailable for job doc %s page %s; will try vision fallback", jd.id, page)
        ocr_text = "\n".join(text_parts)

        fields = []
        for m in tdoc.marks:
            prompt = m.extraction_prompt or ""
            # Layer the Tenant Admin's formatting instruction onto the extraction prompt.
            if m.tenant_format_prompt:
                prompt = f"{prompt}\nThen format the value as follows: {m.tenant_format_prompt}"
            fields.append(
                {
                    "label": m.label_name,
                    "prompt": prompt,
                    "variations": m.anchor_variations or [],
                    "description": m.semantic_description,
                }
            )

        if ocr_text.strip():
            extracted = extract_document_fields(ocr_text, fields)
        else:
            # OCR (Document AI) unavailable — read the values straight from the page images.
            image_paths = [
                _job_doc_dir(jd.id) / "pages" / f"page_{p}.png" for p in range(1, jd.page_count + 1)
            ]
            image_paths = [p for p in image_paths if p.exists()]
            logger.info("Using vision fallback for job doc %s (%d pages)", jd.id, len(image_paths))
            extracted = extract_document_fields_from_images(image_paths, fields)

        for mark in tdoc.marks:
            db.add(
                JobFieldValue(
                    tenant_id=job.tenant_id,
                    job_id=job.id,
                    mark_id=mark.id,
                    template_document_id=tdoc.id,
                    label_name=mark.label_name,
                    extracted_value=extracted.get(mark.label_name),
                )
            )

    job.status = "extracted"
    db.commit()
    db.refresh(job)
    return _build_detail(db, job)


@router.patch("/job-field-values/{value_id}", response_model=JobFieldValueOut)
def correct_field_value(
    value_id: str,
    payload: FieldValueCorrect,
    db: Session = Depends(get_db),
    scope: TenantScope = Depends(get_tenant_scope),
    _=Depends(require_role(OPERATOR, SUPER_ADMIN)),
) -> JobFieldValueOut:
    fv = scoped_query(db, JobFieldValue, scope).filter(JobFieldValue.id == value_id).first()
    if fv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field value not found")
    fv.corrected_value = payload.corrected_value
    db.commit()
    db.refresh(fv)
    tdoc = db.get(TemplateDocument, fv.template_document_id)
    return JobFieldValueOut(
        id=fv.id,
        mark_id=fv.mark_id,
        template_document_id=fv.template_document_id,
        document_name=tdoc.name if tdoc else "?",
        label_name=fv.label_name,
        extracted_value=fv.extracted_value,
        corrected_value=fv.corrected_value,
        value=fv.value,
    )
