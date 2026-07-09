# Cross-Document Verification Linker (frontend)

**Duration estimate:** 1 day · **Assignee:** Magesh
**Depends on:** Interactive Bounding Box Cropper (needs field mappings on 2+ documents)

Full spec, data model, and acceptance criteria live in the backend twin of this
feature: `backend/app/modules/super_admin/cross_document_linker/README.md`.

## What's in this folder

- `CrossDocumentLinkerPage.jsx` — the page component (currently a placeholder card).
- `api.js` — thin wrapper functions around the backend endpoints for this feature.
- `index.jsx` — the route registration object consumed by `src/features/registry.js`.

## How this plugs in

This folder is self-contained. It registers itself with the app in exactly one
place: add its `index.jsx` export to the array in `src/features/registry.js`.
No other feature folder needs to change when you build this one.
