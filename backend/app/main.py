from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine

# --- Import each feature's models so Base.metadata knows about their tables. ---
from app.modules.super_admin.tenant_creation import models as tenant_creation_models  # noqa: F401
from app.modules.super_admin.label_builder import models as label_builder_models  # noqa: F401
from app.modules.super_admin.template_uploader import models as template_uploader_models  # noqa: F401
from app.modules.super_admin.bounding_box_cropper import models as bounding_box_cropper_models  # noqa: F401
from app.modules.super_admin.cross_document_linker import models as cross_document_linker_models  # noqa: F401
from app.modules.super_admin.ai_prompt_editor import models as ai_prompt_editor_models  # noqa: F401
from app.modules.super_admin.ai_training_ui import models as ai_training_ui_models  # noqa: F401

# --- Import each feature's router. ---
from app.modules.super_admin.tenant_creation.routes import router as tenant_creation_router
from app.modules.super_admin.label_builder.routes import router as label_builder_router
from app.modules.super_admin.template_uploader.routes import router as template_uploader_router
from app.modules.super_admin.bounding_box_cropper.routes import router as bounding_box_cropper_router
from app.modules.super_admin.cross_document_linker.routes import router as cross_document_linker_router
from app.modules.super_admin.ai_prompt_editor.routes import router as ai_prompt_editor_router
from app.modules.super_admin.ai_training_ui.routes import router as ai_training_ui_router

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dev convenience: create tables on startup. Replace with Alembic migrations
# before this touches a real production database.
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# PLUGGABLE MODULE REGISTRY
# To add a new Super Admin feature: build its folder under
# app/modules/super_admin/<feature_name>/ (models.py, schemas.py, routes.py),
# then add its router to this list. Nothing else in this file should change.
# ---------------------------------------------------------------------------
SUPER_ADMIN_ROUTERS = [
    tenant_creation_router,
    label_builder_router,
    template_uploader_router,
    bounding_box_cropper_router,
    cross_document_linker_router,
    ai_prompt_editor_router,
    ai_training_ui_router,
]

for router in SUPER_ADMIN_ROUTERS:
    app.include_router(router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}
