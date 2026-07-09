import { Link } from "react-router-dom";

/**
 * AI Prompt Training Loop & Correction UI
 * Duration: 1.5 days | Assignee: Magesh
 * Depends on: AI Transformation Prompt Editor + Interactive Bounding Box Cropper
 *
 * TODO(Magesh): replace this placeholder with the real UI described in
 * ./README.md and backend/app/modules/super_admin/ai_training_ui/README.md
 */
export default function AiTrainingUiPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">AI Prompt Training Loop & Correction UI</h1>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-gray-600 mb-4">The testing screen where admins review extraction results, correct AI mistakes inline, and click 'Train Data' — the correction is stored as a few-shot example so the system avoids the same mistake next time.</p>

        <p className="text-sm font-semibold text-gray-700 mb-2">Acceptance criteria:</p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
          <li>Admin sees extracted + cross-checked values in a preview screen.</li>
          <li>If a value is wrong, admin can select the field, type the correct value, and click 'Train Data'.</li>
          <li>Correction is stored (original_value, corrected_value) against the field mapping.</li>
          <li>Training history per field is viewable so admins can see what's already been corrected.</li>
        </ul>

        <p className="text-xs text-gray-400">
          Depends on: AI Transformation Prompt Editor + Interactive Bounding Box Cropper
        </p>
      </div>

      <Link to="/super-admin" className="inline-block mt-4 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>
    </div>
  );
}
