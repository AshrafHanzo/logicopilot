import BoundingBoxCropperPage from "./BoundingBoxCropperPage";

// Route registration for "Interactive Bounding Box Cropper".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/bounding-box-cropper",
  navLabel: "Interactive Bounding Box Cropper",
  order: 4,
  component: BoundingBoxCropperPage,
};
