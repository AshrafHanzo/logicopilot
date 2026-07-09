import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTenants, listTemplates, uploadTemplate, pageImageUrl } from "./api";

const DOCUMENT_TYPES = ["Invoice", "PackingList", "BL", "Custom"];

export default function TemplateUploaderPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    listTenants()
      .then((rows) => {
        setTenants(rows);
        if (rows.length > 0) setTenantId(String(rows[0].id));
      })
      .catch(() => setError("Failed to load tenants — is the backend running on :8000?"));
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoadingTemplates(true);
    listTemplates(tenantId)
      .then(setTemplates)
      .catch(() => setError("Failed to load templates."))
      .finally(() => setLoadingTemplates(false));
  }, [tenantId]);

  function acceptFile(f) {
    if (!f) return;
    const ok = /\.(pdf|png|jpe?g)$/i.test(f.name);
    if (!ok) {
      setError("Only .pdf, .png, .jpg, .jpeg files are allowed.");
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!tenantId) return setError("Create a tenant first (Customer/Tenant Creation page).");
    if (!file) return setError("Choose a document file to upload.");
    setUploading(true);
    setError(null);
    try {
      const created = await uploadTemplate(tenantId, { name, documentType, file });
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTemplates((prev) => [created, ...prev]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Template Reference Uploader</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Tenant</label>
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {tenants.length === 0 && <option value="">No tenants yet</option>}
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <form onSubmit={handleUpload} className="rounded-xl border border-gray-200 p-5 mb-8 bg-white">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              required
              type="text"
              placeholder='e.g. "Maersk Bill of Lading v2"'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-gray-50"
          }`}
        >
          {file ? (
            <p className="text-sm text-gray-800 font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-500">
              Drag &amp; drop a sample document here (.pdf, .png, .jpg) or click to browse
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading ? "Uploading & rendering pages…" : "Upload Template"}
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Uploaded Templates</h2>
      {loadingTemplates && <p className="text-sm text-gray-400">Loading…</p>}
      {!loadingTemplates && templates.length === 0 && (
        <p className="text-sm text-gray-400">No templates yet for this tenant.</p>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={pageImageUrl(t.id, 1)}
                alt={`${t.name} page 1`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div className="p-3">
              <p className="font-medium text-gray-900 text-sm truncate">{t.name}</p>
              <p className="text-xs text-gray-500 mb-2">
                {t.document_type} · {t.page_count} page{t.page_count > 1 ? "s" : ""}
              </p>
              <button
                onClick={() => navigate(`/super-admin/bounding-box-cropper?template=${t.id}`)}
                className="w-full rounded-lg bg-indigo-50 text-indigo-700 px-3 py-1.5 text-xs font-medium hover:bg-indigo-100"
              >
                Open in Bounding Box Cropper →
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link to="/super-admin" className="inline-block mt-6 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>
    </div>
  );
}
