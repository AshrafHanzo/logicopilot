import LabelBuilderPage from "./LabelBuilderPage";

// Route registration for "Custom Label Builder".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/label-builder",
  navLabel: "Custom Label Builder",
  order: 2,
  component: LabelBuilderPage,
};
