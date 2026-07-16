from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class FieldMark(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A bounding box the admin drew on a document page, with its generated
    extraction profile. 'Mark' == bounding box (the user's term)."""

    __tablename__ = "field_marks"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "bl_number"
    page_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Normalized 0-1 box coordinates (scale to any image resolution).
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="red")

    # Generated extraction profile (both-mode: caption list + semantic fallback).
    detected_anchor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    example_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    anchor_variations: Mapped[list | None] = mapped_column(JSON, nullable=True)
    semantic_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_format_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    correction_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tenant Admin's formatting instruction (e.g. "return the date as MM/DD/YYYY").
    tenant_format_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    verify_with_other_document: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    document: Mapped["TemplateDocument"] = relationship(back_populates="marks")
