import CrossDocumentLinkerPage from "./CrossDocumentLinkerPage";

// Route registration for "Cross-Document Verification Linker".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/cross-document-linker",
  navLabel: "Cross-Document Verification Linker",
  order: 5,
  component: CrossDocumentLinkerPage,
};
