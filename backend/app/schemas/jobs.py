from pydantic import BaseModel, ConfigDict


class JobCreate(BaseModel):
    group_id: str
    reference: str


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    group_id: str
    reference: str
    status: str


class JobDocumentOut(BaseModel):
    id: str
    template_document_id: str
    name: str
    doc_type: str
    is_uploaded: bool
    page_count: int


class JobFieldValueOut(BaseModel):
    id: str
    mark_id: str
    template_document_id: str
    document_name: str
    label_name: str
    extracted_value: str | None
    corrected_value: str | None
    value: str | None


class VerificationRow(BaseModel):
    link_id: str
    field_label: str
    source_document: str
    source_value: str | None
    target_document: str
    target_value: str | None
    status: str  # match | mismatch | missing | review
    accepted: bool = False


class VerificationDecision(BaseModel):
    link_id: str
    accept: bool  # True = accept this row, False = un-accept


class JobDetailOut(BaseModel):
    id: str
    tenant_id: str
    group_id: str
    group_name: str
    reference: str
    status: str
    documents: list[JobDocumentOut]
    field_values: list[JobFieldValueOut]
    verifications: list[VerificationRow]
    all_checks_passed: bool


class FieldValueCorrect(BaseModel):
    corrected_value: str


class AvailableGroup(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    status: str
