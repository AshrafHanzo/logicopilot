// ---------------------------------------------------------------------------
// SUPER ADMIN NAV — the wizard flow collapses the old 7 feature pages into
// just two sidebar options:
//   1. Customer/Tenant Creation      -> the dashboard (tenant + admin management)
//   2. Customer with Template Creation -> the step-by-step onboarding wizard
// Pure data only (no component imports) so importing this never creates a cycle
// with AppShell. Route components are wired directly in routes.tsx.
// ---------------------------------------------------------------------------

export const superAdminFeatures = [
  { path: "/super-admin", navLabel: "Customer/Tenant Creation", order: 1 },
  { path: "/super-admin/template-creation", navLabel: "Customer with Template Creation", order: 2 },
  { path: "/super-admin/template-list", navLabel: "Template List", order: 3 },
  { path: "/jobs", navLabel: "Jobs", order: 4 },
].sort((a, b) => a.order - b.order);
