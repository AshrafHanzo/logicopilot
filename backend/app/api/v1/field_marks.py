import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.anchors import detect_value_and_anchor
from app.core.config import get_settings
from app.core.deps import get_db, require_role
from app.core.docai import get_page_ocr, ocr_page_image
from app.core.extraction import extract_document_fields, extract_document_fields_from_images
from app.core.llm import build_field_profile
from app.models.cross_doc_link import CrossDocLink
from app.models.field_mark import FieldMark
from app.models.template_document import TemplateDocument
from app.models.user import SUPER_ADMIN
from app.schemas.onboarding import (
    CrossDocLinkCreate,
    CrossDocLinkOut,
    DemoFieldResult,
    DemoResult,
    LinkFieldToDocuments,
    MarkCorrect,
    MarkCreate,
    MarkOut,
)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_TEST_BYTES = 25 * 1024 * 1024

logger = logging.getLogger(__name__)

router = APIRouter(tags=["onboarding: marks"])


def _document_dir(document_id: str) -> Path:
    return Path(get_settings().uploads_dir) / "documents" / document_id


def _box(mark_or_payload) -> dict:
    return {
        "x0": mark_or_payload.x,
        "y0": mark_or_payload.y,
        "x1": mark_or_payload.x + mark_or_payload.width,
        "y1": mark_or_payload.y + mark_or_payload.height,
    }


def _apply_profile(mark: FieldMark, document: TemplateDocument, db: Session) -> None:
    """Best-effort: OCR the page (cached), detect value + anchor, build the extraction
    profile. A Document AI outage leaves the mark saved with a null profile for later
    re-detection rather than failing the whole request."""
    value_text = anchor = None
    try:
        ocr = get_page_ocr(_document_dir(document.id), mark.page_number)
        value_text, anchor = detect_value_and_anchor(ocr, _box(mark))
    except Exception:  # noqa: BLE001
        logger.exception("OCR/anchor detection failed for mark %s", mark.id)

    # For "Custom" docs the type carries no meaning, so feed the human document name
    # (e.g. "Insurance Certificate") as context; otherwise combine name + type.
    doc_context = document.name if document.doc_type == "Custom" else f"{document.name} ({document.doc_type})"
    profile = build_field_profile(
        field_name=mark.label_name,
        anchor_term=anchor,
        value_text=value_text,
        document_type=doc_context,
        correction_prompt=mark.correction_prompt,
    )
    mark.detected_anchor = anchor
    mark.example_value = value_text
    mark.anchor_variations = profile.anchor_variations
    mark.semantic_description = profile.semantic_description
    mark.value_format_hint = profile.value_format_hint
    mark.extraction_prompt = profile.extraction_prompt
    db.commit()
    db.refresh(mark)


@router.post(
    "/template-documents/{document_id}/marks",
    response_model=MarkOut,
    status_code=status.HTTP_201_CREATED,
)
def create_mark(
    document_id: str,
    payload: MarkCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> MarkOut:
    document = db.get(TemplateDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if not document.is_uploaded:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload the document file first")
    for name in ("x", "y", "width", "height"):
        if not 0 <= getattr(payload, name) <= 1:
            raise HTTPException(status_code=422, detail=f"{name} must be a normalized 0-1 coordinate")
    if payload.width <= 0.001 or payload.height <= 0.001:
        raise HTTPException(status_code=422, detail="Mark box is too small")

    mark = FieldMark(
        tenant_id=document.tenant_id,
        document_id=document.id,
        label_name=payload.label_name,
        page_number=payload.page_number,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        color=payload.color,
        verify_with_other_document=payload.verify_with_other_document,
    )
    db.add(mark)
    db.commit()
    db.refresh(mark)

    _apply_profile(mark, document, db)  # Step 4: saved as a system prompt
    return MarkOut.model_validate(mark)


@router.get("/template-documents/{document_id}/marks", response_model=list[MarkOut])
def list_marks(
    document_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> list[MarkOut]:
    if db.get(TemplateDocument, document_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    marks = db.query(FieldMark).filter(FieldMark.document_id == document_id).all()
    return [MarkOut.model_validate(m) for m in marks]


@router.delete("/marks/{mark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mark(
    mark_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> None:
    mark = db.get(FieldMark, mark_id)
    if mark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mark not found")
    db.delete(mark)
    db.commit()


@router.patch("/marks/{mark_id}/correct", response_model=MarkOut)
def correct_mark(
    mark_id: str,
    payload: MarkCorrect,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> MarkOut:
    """Step 6: fold a human correction into the field and regenerate its prompt."""
    mark = db.get(FieldMark, mark_id)
    if mark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mark not found")
    document = db.get(TemplateDocument, mark.document_id)
    mark.correction_prompt = payload.correction_prompt
    db.commit()
    _apply_profile(mark, document, db)
    return MarkOut.model_validate(mark)


@router.get("/template-documents/{document_id}/demo", response_model=DemoResult)
def demo_extract(
    document_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> DemoResult:
    """Step 5: show what each mark extracts from the reference document."""
    document = db.get(TemplateDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    marks = db.query(FieldMark).filter(FieldMark.document_id == document_id).all()

    results: list[DemoFieldResult] = []
    ocr_by_page: dict[int, dict] = {}
    for mark in marks:
        value = mark.example_value
        try:
            if mark.page_number not in ocr_by_page:
                ocr_by_page[mark.page_number] = get_page_ocr(_document_dir(document_id), mark.page_number)
            value, _ = detect_value_and_anchor(ocr_by_page[mark.page_number], _box(mark))
        except Exception:  # noqa: BLE001 — fall back to the stored example value
            logger.exception("Demo extraction failed for mark %s", mark.id)
        results.append(
            DemoFieldResult(
                mark_id=mark.id,
                label_name=mark.label_name,
                extracted_value=value,
                matched_anchor=mark.detected_anchor,
            )
        )
    return DemoResult(document_id=document_id, results=results)


# --------------------------------------------------------------------------- #
# Cross-document links (Step 3 "present in another document?" popup)
# --------------------------------------------------------------------------- #
@router.post("/cross-doc-links", response_model=CrossDocLinkOut, status_code=status.HTTP_201_CREATED)
def create_cross_doc_link(
    payload: CrossDocLinkCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> CrossDocLinkOut:
    source = db.get(FieldMark, payload.source_mark_id)
    target = db.get(FieldMark, payload.target_mark_id)
    if source is None or target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mark not found")
    source_doc = db.get(TemplateDocument, source.document_id)
    target_doc = db.get(TemplateDocument, target.document_id)
    if source_doc.group_id != target_doc.group_id:
        raise HTTPException(status_code=422, detail="Both marks must belong to the same template group")
    if source.document_id == target.document_id:
        raise HTTPException(status_code=422, detail="Link must connect marks on two different documents")

    link = CrossDocLink(
        tenant_id=source.tenant_id,
        group_id=source_doc.group_id,
        source_mark_id=source.id,
        target_mark_id=target.id,
        condition=payload.condition,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return CrossDocLinkOut.model_validate(link)


@router.post(
    "/field-marks/{source_mark_id}/link-documents",
    response_model=list[CrossDocLinkOut],
    status_code=status.HTTP_201_CREATED,
)
def link_field_to_documents(
    source_mark_id: str,
    payload: LinkFieldToDocuments,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> list[CrossDocLinkOut]:
    """Cross-doc verify WITHOUT re-cropping: for each target document, copy the source
    field's semantic profile onto a field there (so extraction finds the same value by
    meaning) and link them. No second bounding box needed."""
    source = db.get(FieldMark, source_mark_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source field not found")
    source_doc = db.get(TemplateDocument, source.document_id)

    source.verify_with_other_document = True
    created: list[CrossDocLink] = []
    for doc_id in dict.fromkeys(payload.target_document_ids):
        if doc_id == source.document_id:
            continue
        tdoc = db.get(TemplateDocument, doc_id)
        if tdoc is None or tdoc.group_id != source_doc.group_id:
            raise HTTPException(status_code=422, detail="Target document is not in the same template group.")

        # Reuse an existing field with this label on the target doc, else create one that
        # carries the SOURCE field's profile (no coordinates needed — extraction is prompt/semantic).
        target = (
            db.query(FieldMark)
            .filter(FieldMark.document_id == doc_id, FieldMark.label_name == source.label_name)
            .first()
        )
        if target is None:
            target = FieldMark(
                tenant_id=source.tenant_id,
                document_id=doc_id,
                label_name=source.label_name,
                page_number=1,
                x=source.x, y=source.y, width=source.width, height=source.height,
                color=source.color,
                detected_anchor=source.detected_anchor,
                anchor_variations=source.anchor_variations,
                semantic_description=source.semantic_description,
                value_format_hint=source.value_format_hint,
                extraction_prompt=source.extraction_prompt,
                verify_with_other_document=True,
            )
            db.add(target)
            db.flush()

        # Skip if this exact link already exists.
        exists = (
            db.query(CrossDocLink)
            .filter(CrossDocLink.source_mark_id == source.id, CrossDocLink.target_mark_id == target.id)
            .first()
        )
        if exists:
            continue
        link = CrossDocLink(
            tenant_id=source.tenant_id,
            group_id=source_doc.group_id,
            source_mark_id=source.id,
            target_mark_id=target.id,
            condition=payload.condition,
        )
        db.add(link)
        db.flush()
        created.append(link)

    db.commit()
    return [CrossDocLinkOut.model_validate(c) for c in created]


@router.delete("/cross-doc-links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cross_doc_link(
    link_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> None:
    link = db.get(CrossDocLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    db.delete(link)
    db.commit()


# --------------------------------------------------------------------------- #
# Wizard Demo (Step 5) — test the configured prompts on a DIFFERENT uploaded doc
# --------------------------------------------------------------------------- #
@router.post("/template-documents/{document_id}/test-extract", response_model=DemoResult)
def test_extract(
    document_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_role(SUPER_ADMIN)),
) -> DemoResult:
    """Run this document's configured field prompts against an unseen uploaded file,
    without persisting anything — lets the admin confirm the config generalizes."""
    import fitz  # PyMuPDF

    document = db.get(TemplateDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    marks = db.query(FieldMark).filter(FieldMark.document_id == document_id).all()
    if not marks:
        return DemoResult(document_id=document_id, results=[])

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail=f"File type not allowed — use one of {sorted(ALLOWED_EXTENSIONS)}")
    content = file.file.read(MAX_TEST_BYTES + 1)
    if len(content) > MAX_TEST_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    fields = [
        {
            "label": m.label_name,
            "prompt": m.extraction_prompt,
            "variations": m.anchor_variations or [],
            "description": m.semantic_description,
        }
        for m in marks
    ]

    tdir = Path(get_settings().uploads_dir) / "_test" / document_id
    try:
        shutil.rmtree(tdir, ignore_errors=True)
        tdir.mkdir(parents=True, exist_ok=True)
        original = tdir / f"test{ext}"
        original.write_bytes(content)
        text_parts: list[str] = []
        image_paths: list[Path] = []
        with fitz.open(original) as doc:
            for i, page in enumerate(doc, start=1):
                png = tdir / f"page_{i}.png"
                page.get_pixmap(dpi=150).save(png)
                image_paths.append(png)
                try:
                    text_parts.append(ocr_page_image(png).get("text", ""))
                except Exception:  # noqa: BLE001 — OCR (Document AI) unavailable; vision fallback below
                    logger.warning("OCR unavailable for test doc page %s; will try vision fallback", i)
        ocr_text = "\n".join(text_parts)

        if ocr_text.strip():
            extracted = extract_document_fields(ocr_text, fields)
        else:
            extracted = extract_document_fields_from_images(image_paths, fields)
    except Exception:  # noqa: BLE001
        logger.exception("Test extraction failed for document %s", document_id)
        raise HTTPException(status_code=422, detail="Could not read the uploaded test document.")
    finally:
        shutil.rmtree(tdir, ignore_errors=True)
    results = [
        DemoFieldResult(
            mark_id=m.id,
            label_name=m.label_name,
            extracted_value=extracted.get(m.label_name),
            matched_anchor=m.detected_anchor,
        )
        for m in marks
    ]
    return DemoResult(document_id=document_id, results=results)
