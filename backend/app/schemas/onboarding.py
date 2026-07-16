from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Step 1 — declare the group and its documents
# --------------------------------------------------------------------------- #
class DocumentDeclaration(BaseModel):
    name: str
    doc_type: str = "Custom"


class TemplateGroupCreate(BaseModel):
    tenant_id: str
    name: str
    documents: list[DocumentDeclaration] = Field(min_length=1)


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    group_id: str
    name: str
    doc_type: str
    order_index: int
    page_count: int
    is_uploaded: bool
    # NOTE: file_path is intentionally NOT exposed.


class MarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    label_name: str
    page_number: int
    x: float
    y: float
    width: float
    height: float
    color: str
    detected_anchor: str | None
    example_value: str | None
    anchor_variations: list[str] | None
    semantic_description: str | None
    value_format_hint: str | None
    extraction_prompt: str | None
    correction_prompt: str | None
    tenant_format_prompt: str | None = None
    verify_with_other_document: bool


class CrossDocLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    group_id: str
    source_mark_id: str
    target_mark_id: str
    condition: str


class DocumentDetailOut(DocumentOut):
    marks: list[MarkOut] = []


class TemplateGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    status: str


class TemplateGroupDetailOut(TemplateGroupOut):
    documents: list[DocumentDetailOut] = []
    cross_doc_links: list[CrossDocLinkOut] = []


# --------------------------------------------------------------------------- #
# Step 3 — create a mark (bounding box)
# --------------------------------------------------------------------------- #
class MarkCreate(BaseModel):
    label_name: str
    page_number: int = 1
    x: float
    y: float
    width: float
    height: float
    color: str = "red"
    verify_with_other_document: bool = False


class MarkCorrect(BaseModel):
    correction_prompt: str


# --------------------------------------------------------------------------- #
# Step 3 cross-doc — link a source mark to a target mark
# --------------------------------------------------------------------------- #
class CrossDocLinkCreate(BaseModel):
    source_mark_id: str
    target_mark_id: str
    condition: str = "must_equal"


class LinkFieldToDocuments(BaseModel):
    """Link a source field to other documents WITHOUT re-cropping: the field's
    semantic profile is copied so extraction finds the same value on each target doc."""

    target_document_ids: list[str]
    condition: str = "must_equal"


# --------------------------------------------------------------------------- #
# Step 5 — demo run (what each mark extracts from the reference doc)
# --------------------------------------------------------------------------- #
class DemoFieldResult(BaseModel):
    mark_id: str
    label_name: str
    extracted_value: str | None
    matched_anchor: str | None


class DemoResult(BaseModel):
    document_id: str
    results: list[DemoFieldResult]
