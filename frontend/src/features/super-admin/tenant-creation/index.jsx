import TenantCreationPage from "./TenantCreationPage";

// Route registration for "Customer/Tenant Creation".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/tenant-creation",
  navLabel: "Customer/Tenant Creation",
  order: 1,
  component: TenantCreationPage,
};
