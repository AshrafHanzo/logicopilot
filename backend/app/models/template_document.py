from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TemplateDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One document within a group (e.g. the 'BL'). Named first (Step 1), its sample
    file uploaded later (Step 2), then marked (Step 3)."""

    __tablename__ = "template_documents"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "BL", "Invoice"
    doc_type: Mapped[str] = mapped_column(String(30), nullable=False, default="Custom")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Set on upload (Step 2). file_path is internal only — never serialized to the client.
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    group: Mapped["TemplateGroup"] = relationship(back_populates="documents")
    marks: Mapped[list["FieldMark"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="FieldMark.created_at"
    )

    @property
    def is_uploaded(self) -> bool:
        return self.file_path is not None
