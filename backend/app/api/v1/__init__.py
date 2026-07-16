from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.users import router as users_router
from app.api.v1.template_groups import router as template_groups_router
from app.api.v1.template_documents import router as template_documents_router
from app.api.v1.field_marks import router as field_marks_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.reviews import router as reviews_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(users_router)
api_router.include_router(template_groups_router)
api_router.include_router(template_documents_router)
api_router.include_router(field_marks_router)
api_router.include_router(jobs_router)
api_router.include_router(reviews_router)
