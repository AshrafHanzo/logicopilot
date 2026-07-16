from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TemplateGroup(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """One 'Customer with Template Creation' unit: a named set of documents
    (BL + Invoice + Packing List ...) configured for a tenant in the wizard."""

    __tablename__ = "template_groups"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft | ready

    documents: Mapped[list["TemplateDocument"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", order_by="TemplateDocument.order_index"
    )
