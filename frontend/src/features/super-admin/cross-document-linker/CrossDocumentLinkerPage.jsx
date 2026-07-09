import { Link } from "react-router-dom";

/**
 * Cross-Document Verification Linker
 * Duration: 1 day | Assignee: Magesh
 * Depends on: Interactive Bounding Box Cropper (needs field mappings on 2+ documents)
 *
 * TODO(Magesh): replace this placeholder with the real UI described in
 * ./README.md and backend/app/modules/super_admin/cross_document_linker/README.md
 */
export default function CrossDocumentLinkerPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Cross-Document Verification Linker</h1>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-gray-600 mb-4">Left sidebar UI that lets admins link a label's value on Document A to the corresponding target area on Document B, with a condition (Must Equal / Must Be Greater Than / Must Contain) for semantic cross-checking.</p>

        <p className="text-sm font-semibold text-gray-700 mb-2">Acceptance criteria:</p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
          <li>Only labels marked 'Verify with other document = Yes' show up as linkable in the sidebar.</li>
          <li>Admin selects a previously-cropped label, then draws the matching box on the second document.</li>
          <li>Link is stored as source field mapping &rarr; target field mapping + a condition.</li>
          <li>Verification is semantic, not string-exact (e.g. '1.5 MT' == '1500 KGS', '12-May-2026' == '2026/05/12') — the actual semantic check runs in the AI Extraction Engine module, this feature only captures and stores the link.</li>
        </ul>

        <p className="text-xs text-gray-400">
          Depends on: Interactive Bounding Box Cropper (needs field mappings on 2+ documents)
        </p>
      </div>

      <Link to="/super-admin" className="inline-block mt-4 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>
    </div>
  );
}
