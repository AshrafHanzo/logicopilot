# Logicopilot AI

Fresh, feature-pluggable codebase for the Logicopilot AI platform, started with the
**Super Admin Panel & Onboarding Wizard** module (7 features below). This is
separate from the existing `backend/`/`frontend/` proof-of-concept at the repo
root — that POC stays as-is; this folder is the real multi-tenant build.

Spec sources: `document/implementation_plan.md`, `document/Logicopilot_Implementation_Plan.docx`,
`document/workbooster_architecture_and_guide.md`, `document/workbooster_product_overview.md`.

## Stack

- **Backend:** FastAPI + SQLAlchemy + SQLite (see `backend/.env.example` — swap
  `DATABASE_URL` to Postgres later with no code changes, since SQLAlchemy abstracts it).
- **Frontend:** React + Vite + Tailwind + React Router + Axios.
- No Docker for now — run both processes directly (see below).

## Why it's organized this way (pluggable-by-feature)

Every feature — frontend and backend — lives in its own self-contained folder and
only touches the rest of the app in **one line**:

- Backend: `backend/app/modules/super_admin/<feature>/routes.py` is included once
  in `backend/app/main.py`'s `SUPER_ADMIN_ROUTERS` list.
- Frontend: `frontend/src/features/super-admin/<feature>/index.jsx` is added once
  to `frontend/src/features/registry.js`'s array.

Building or rewriting one feature never requires editing another feature's files.
Each feature folder has its own `README.md` with the spec, data model, and
acceptance criteria pulled from the docs above.

## Super Admin Panel — 7 features (in dependency order)

| # | Feature | Duration | Assignee | Depends on |
|---|---------|----------|----------|------------|
| 1 | [Customer/Tenant Creation](backend/app/modules/super_admin/tenant_creation/README.md) | Half day | Magesh | None (foundational — every other feature needs a tenant_id) |
| 2 | [Custom Label Builder](backend/app/modules/super_admin/label_builder/README.md) | 1 day | Magesh | Customer/Tenant Creation (needs a tenant_id) |
| 3 | [Template Reference Uploader](backend/app/modules/super_admin/template_uploader/README.md) | 1 day | Magesh | Customer/Tenant Creation (needs a tenant_id) |
| 4 | [Interactive Bounding Box Cropper](backend/app/modules/super_admin/bounding_box_cropper/README.md) | 1.5 days | Magesh | Custom Label Builder + Template Reference Uploader |
| 5 | [Cross-Document Verification Linker](backend/app/modules/super_admin/cross_document_linker/README.md) | 1 day | Magesh | Interactive Bounding Box Cropper (needs field mappings on 2+ documents) |
| 6 | [AI Transformation Prompt Editor](backend/app/modules/super_admin/ai_prompt_editor/README.md) | 1 day | Magesh | Interactive Bounding Box Cropper (needs a field mapping to attach a prompt to) |
| 7 | [AI Prompt Training Loop & Correction UI](backend/app/modules/super_admin/ai_training_ui/README.md) | 1.5 days | Magesh | AI Transformation Prompt Editor + Interactive Bounding Box Cropper |

**Total: 7.5 days** (matches `Logicopilot_Implementation_Plan.docx`, Module 2).

## Running it

**Backend:**
```bash
cd logicopilot/backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd logicopilot/frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173/super-admin` — it lists all 7 features and links to
each placeholder page. API docs (once the backend runs) are at
`http://localhost:8000/docs`.

## Current state

Every endpoint and page in the 7 feature folders is a **stub**: the file
structure, database schema, request/response contracts (Pydantic schemas), and
route signatures are real and match the docs — but route handlers raise
`501 Not Implemented` and pages render a placeholder card. This is intentional:
the scaffolding + contracts are done so `Magesh` can implement
each feature's real logic independently, in any order that respects the
dependency column above.

## Not yet set up (do before production)

- Alembic migrations (currently `Base.metadata.create_all` on startup — fine for
  dev, not for schema changes on a real database).
- Auth / multi-tenant access control (Module 1 in the implementation plan — a
  separate module, not part of this Super Admin feature set).
- Postgres swap for production (`DATABASE_URL` in `.env`).

## Next modules (same pattern)

Tenant Admin Panel, Daily Operator Dashboard, AI Document Extraction Engine, RPA
Web Recorder, and Security & Access should each get their own
`app/modules/<module_name>/<feature>/` and `src/features/<module-name>/<feature>/`
trees, following exactly this structure.
