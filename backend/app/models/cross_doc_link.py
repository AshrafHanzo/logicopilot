from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class CrossDocLink(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links the same value across two documents in a group, e.g. bl_number on the
    BL must match bl_number on the Invoice. Created via the Step-3 'present in another
    document?' popup: one link row per chosen target document."""

    __tablename__ = "cross_doc_links"

    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_mark_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("field_marks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_mark_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("field_marks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    condition: Mapped[str] = mapped_column(String(30), nullable=False, default="must_equal")
