// ---------------------------------------------------------------------------
// PLUGGABLE FEATURE REGISTRY
// To add a new Super Admin feature: build its folder under
// src/features/super-admin/<feature-slug>/ (Page.jsx, api.js, index.jsx),
// then add its default export to this array. Nothing else needs to change —
// App.jsx and the nav both render from this list.
// ---------------------------------------------------------------------------

import tenantCreation from "./super-admin/tenant-creation";
import labelBuilder from "./super-admin/label-builder";
import templateUploader from "./super-admin/template-uploader";
import boundingBoxCropper from "./super-admin/bounding-box-cropper";
import crossDocumentLinker from "./super-admin/cross-document-linker";
import aiPromptEditor from "./super-admin/ai-prompt-editor";
import aiTrainingUi from "./super-admin/ai-training-ui";

export const superAdminFeatures = [
  tenantCreation,
  labelBuilder,
  templateUploader,
  boundingBoxCropper,
  crossDocumentLinker,
  aiPromptEditor,
  aiTrainingUi,
].sort((a, b) => a.order - b.order);
