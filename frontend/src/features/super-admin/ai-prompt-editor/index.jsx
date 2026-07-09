import AiPromptEditorPage from "./AiPromptEditorPage";

// Route registration for "AI Transformation Prompt Editor".
// Adding this feature to the app is just adding this export to
// src/features/registry.js — no other file needs to change.
export default {
  path: "/super-admin/ai-prompt-editor",
  navLabel: "AI Transformation Prompt Editor",
  order: 6,
  component: AiPromptEditorPage,
};
