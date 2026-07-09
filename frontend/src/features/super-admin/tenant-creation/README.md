# Customer/Tenant Creation (frontend)

**Status:** ✅ Implemented (reference example for the other 6 features)
**Duration estimate:** Half day · **Assignee:** Magesh
**Depends on:** None (foundational — every other feature needs a tenant_id)

Full spec, data model, and acceptance criteria live in the backend twin of this
feature: `backend/app/modules/super_admin/tenant_creation/README.md`.

## What's in this folder

- `TenantCreationPage.jsx` — real page: tenant table + "+ Create New Tenant" modal
  (Company Name, Primary Contact Email, Region, Base Currency, optional Timezone).
- `api.js` — real axios calls (`listTenants`, `createTenant`) against the backend.
- `index.jsx` — the route registration object consumed by `src/features/registry.js`.

## How this plugs in

This folder is self-contained. It registers itself with the app in exactly one
place: add its `index.jsx` export to the array in `src/features/registry.js`.
No other feature folder needs to change when you build this one.
