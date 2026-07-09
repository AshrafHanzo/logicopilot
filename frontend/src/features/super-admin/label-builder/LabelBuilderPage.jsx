import { Link } from "react-router-dom";

/**
 * Custom Label Builder
 * Duration: 1 day | Assignee: Magesh
 * Depends on: Customer/Tenant Creation (needs a tenant_id)
 *
 * TODO(Magesh): replace this placeholder with the real UI described in
 * ./README.md and backend/app/modules/super_admin/label_builder/README.md
 */
export default function LabelBuilderPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Custom Label Builder</h1>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-gray-600 mb-4">Interface to create data tags (e.g. invoice_no, gross_weight), define their data type, and toggle 'Verify with other document' for cross-doc validation.</p>

        <p className="text-sm font-semibold text-gray-700 mb-2">Acceptance criteria:</p>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
          <li>Super Admin can create unlimited labels per tenant (key-value concept, e.g. `container_number`).</li>
          <li>Each label has a Data Type: String, Number, Date, or Currency.</li>
          <li>Each label has an 'Is Required Field' toggle.</li>
          <li>Each label has a 'Verify with other document' checkbox (Yes/No) — flags it for cross-doc AI verification later.</li>
        </ul>

        <p className="text-xs text-gray-400">
          Depends on: Customer/Tenant Creation (needs a tenant_id)
        </p>
      </div>

      <Link to="/super-admin" className="inline-block mt-4 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>
    </div>
  );
}
