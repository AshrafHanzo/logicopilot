import AiTrainingUiPage from "./AiTrainingUiPage";

// Route registration for "AI Prompt Training Loop & Correction UI".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/ai-training-ui",
  navLabel: "AI Prompt Training Loop & Correction UI",
  order: 7,
  component: AiTrainingUiPage,
};
