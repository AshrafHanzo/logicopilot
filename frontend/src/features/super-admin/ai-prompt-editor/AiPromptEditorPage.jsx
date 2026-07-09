import { Link } from "react-router-dom";

/**
 * AI Transformation Prompt Editor
 * Duration: 1 day | Assignee: Magesh
 * Depends on: Interactive Bounding Box Cropper (needs a field mapping to attach a prompt to)
 *
 * TODO(Magesh): replace this placeholder with the real UI described in
 * ./README.md and backend/app/modules/super_admin/ai_prompt_editor/README.md
 */
export default function AiPromptEditorPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Transformation Prompt Editor</h1>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-gray-600 mb-4">Input field (opened via a field's three-dots menu) to write natural language rules for how the extracted value should be formatted, e.g. 'Remove the letters KGS and return only numbers.'</p>

        <p className="text-sm font-semibold text-gray-700 mb-2">Acceptance criteria:</p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
          <li>Each field mapping can have exactly one transformation prompt (create-or-update / upsert).</li>
          <li>Prompt is free-text natural language, sent to the AI Extraction Engine at run time (that engine is a separate module — this feature only stores the prompt).</li>
          <li>Editing an existing prompt updates it in place and is reflected next extraction run.</li>
        </ul>

        <p className="text-xs text-gray-400">
          Depends on: Interactive Bounding Box Cropper (needs a field mapping to attach a prompt to)
        </p>
      </div>

      <Link to="/super-admin" className="inline-block mt-4 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>
    </div>
  );
}
