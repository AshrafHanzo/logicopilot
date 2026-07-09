import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createTenant, listTenants } from "./api";

const REGIONS = ["US", "EU", "ASIA"];
const CURRENCIES = ["USD", "EUR", "GBP"];

const EMPTY_FORM = {
  name: "",
  primary_contact_email: "",
  region: REGIONS[0],
  base_currency: CURRENCIES[0],
  timezone: "",
};

export default function TenantCreationPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      setTenants(await listTenants());
    } catch (err) {
      setError("Failed to load tenants — is the backend running on :8000?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openModal() {
    setForm(EMPTY_FORM);
    setError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...form };
      if (!payload.timezone) delete payload.timezone;
      await createTenant(payload);
      setIsModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail ? JSON.stringify(err.response.data.detail) : "Failed to create tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Customer/Tenant Creation</h1>
        <button
          onClick={openModal}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Create New Tenant
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Company Name</th>
              <th className="px-4 py-3">Contact Email</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td className="px-4 py-4 text-gray-400" colSpan={5}>Loading tenants…</td>
              </tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-gray-400" colSpan={5}>
                  No tenants yet — click "+ Create New Tenant" to add one (e.g. 4S Logistics).
                </td>
              </tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                <td className="px-4 py-3 text-gray-600">{t.primary_contact_email}</td>
                <td className="px-4 py-3 text-gray-600">{t.region}</td>
                <td className="px-4 py-3 text-gray-600">{t.base_currency}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && !isModalOpen && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Link to="/super-admin" className="inline-block mt-6 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Tenant</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 4S Logistics"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Contact Email</label>
                <input
                  required
                  type="email"
                  placeholder="ops@4slogistics.com"
                  value={form.primary_contact_email}
                  onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Currency</label>
                  <select
                    value={form.base_currency}
                    onChange={(e) => setForm({ ...form, base_currency: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Asia/Kolkata"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
