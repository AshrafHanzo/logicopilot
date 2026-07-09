import TemplateUploaderPage from "./TemplateUploaderPage";

// Route registration for "Template Reference Uploader".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/template-uploader",
  navLabel: "Template Reference Uploader",
  order: 3,
  component: TemplateUploaderPage,
};
