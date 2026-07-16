from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Job(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One run of a configured template set against a real transaction's documents.
    Created by an Operator; visible to the Operator's tenant and to Super Admins."""

    __tablename__ = "jobs"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reference: Mapped[str] = mapped_column(String(255), nullable=False)  # operator's label, e.g. shipment no
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft | extracted | completed
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Cross-doc-link ids the operator explicitly accepted despite a review/mismatch flag.
    accepted_verifications: Mapped[list | None] = mapped_column(JSON, nullable=True)

    documents: Mapped[list["JobDocument"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    field_values: Mapped[list["JobFieldValue"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class JobDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """A real uploaded file fulfilling one of the template set's declared documents."""

    __tablename__ = "job_documents"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    job: Mapped["Job"] = relationship(back_populates="documents")


class JobFieldValue(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """An extracted (and optionally corrected) value for one configured field on this job."""

    __tablename__ = "job_field_values"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mark_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("field_marks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_name: Mapped[str] = mapped_column(String(100), nullable=False)
    extracted_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    corrected_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    job: Mapped["Job"] = relationship(back_populates="field_values")

    @property
    def value(self) -> str | None:
        return self.corrected_value if self.corrected_value is not None else self.extracted_value
