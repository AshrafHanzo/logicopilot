"""Imported by Alembic's env.py so autogenerate can see every model via Base.metadata."""

from app.db.base_class import Base  # noqa: F401
from app.models.tenant import Tenant  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.template_group import TemplateGroup  # noqa: F401
from app.models.template_document import TemplateDocument  # noqa: F401
from app.models.field_mark import FieldMark  # noqa: F401
from app.models.cross_doc_link import CrossDocLink  # noqa: F401
from app.models.job import Job, JobDocument, JobFieldValue  # noqa: F401
from app.models.template_review import TemplateReview  # noqa: F401
from app.models.user_template import UserTemplateAssignment  # noqa: F401
from app.models.erp_access import ErpAccessRequest  # noqa: F401
