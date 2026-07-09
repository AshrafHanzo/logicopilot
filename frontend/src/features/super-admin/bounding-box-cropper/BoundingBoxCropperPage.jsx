import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createFieldMapping,
  createLabel,
  deleteFieldMapping,
  getTemplate,
  listFieldMappings,
  listLabels,
  listTemplates,
  listTenants,
  pageImageUrl,
  redetectAnchor,
} from "./api";

// 5-color system: Red=IDs, Green=amounts/numbers, Blue=general text, Yellow=dates, Purple=long text
const COLORS = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
};
const DATA_TYPES = ["String", "Number", "Date", "Currency"];

const EMPTY_FORM = {
  field_name: "",
  data_type: "String",
  color: "red",
  is_required: false,
  verify_with_other_document: false,
};

export default function BoundingBoxCropperPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const templateIdParam = searchParams.get("template");

  // Template picker state (used when arriving without ?template=)
  const [tenants, setTenants] = useState([]);
  const [pickerTenantId, setPickerTenantId] = useState("");
  const [pickerTemplates, setPickerTemplates] = useState([]);

  // Cropper state
  const [template, setTemplate] = useState(null);
  const [page, setPage] = useState(1);
  const [labels, setLabels] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Drawing state
  const imgWrapRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState(null); // {x0, y0, x1, y1} normalized

  // Save-modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyMappingId, setBusyMappingId] = useState(null);

  useEffect(() => {
    if (templateIdParam) {
      setError(null);
      getTemplate(templateIdParam)
        .then((t) => {
          setTemplate(t);
          setPage(1);
          return Promise.all([listLabels(t.tenant_id), listFieldMappings(t.id)]);
        })
        .then(([labelRows, mappingRows]) => {
          setLabels(labelRows);
          setMappings(mappingRows);
        })
        .catch(() => setError("Failed to load template — is the backend running on :8000?"));
    } else {
      listTenants()
        .then((rows) => {
          setTenants(rows);
          if (rows.length > 0) setPickerTenantId(String(rows[0].id));
        })
        .catch(() => setError("Failed to load tenants — is the backend running on :8000?"));
    }
  }, [templateIdParam]);

  useEffect(() => {
    if (!pickerTenantId || templateIdParam) return;
    listTemplates(pickerTenantId).then(setPickerTemplates).catch(() => {});
  }, [pickerTenantId, templateIdParam]);

  const labelById = useMemo(
    () => Object.fromEntries(labels.map((l) => [l.id, l])),
    [labels]
  );
  const pageMappings = useMemo(
    () => mappings.filter((m) => m.page_number === page),
    [mappings, page]
  );

  function relPoint(e) {
    const rect = imgWrapRef.current.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  }

  function onMouseDown(e) {
    if (!template || modalOpen) return;
    e.preventDefault();
    const p = relPoint(e);
    setDrawing(true);
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }

  function onMouseMove(e) {
    if (!drawing) return;
    const p = relPoint(e);
    setDraft((d) => ({ ...d, x1: p.x, y1: p.y }));
  }

  function onMouseUp() {
    if (!drawing || !draft) return;
    setDrawing(false);
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    if (w < 0.005 || h < 0.005) {
      setDraft(null);
      return;
    }
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function normalizedDraft() {
    return {
      x: Math.min(draft.x0, draft.x1),
      y: Math.min(draft.y0, draft.y1),
      width: Math.abs(draft.x1 - draft.x0),
      height: Math.abs(draft.y1 - draft.y0),
    };
  }

  async function saveMapping(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fieldName = form.field_name.trim();
      let label = labels.find(
        (l) => l.field_name.toLowerCase() === fieldName.toLowerCase()
      );
      if (!label) {
        label = await createLabel(template.tenant_id, {
          field_name: fieldName,
          data_type: form.data_type,
          is_required: form.is_required,
          verify_with_other_document: form.verify_with_other_document,
        });
        setLabels((prev) => [...prev, label]);
      }
      const box = normalizedDraft();
      const mapping = await createFieldMapping(template.id, {
        template_id: template.id,
        label_id: label.id,
        page_number: page,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color: form.color,
      });
      setMappings((prev) => [...prev, mapping]);
      setModalOpen(false);
      setDraft(null);

      let message = mapping.anchor_term
        ? `Saved. Document AI detected anchor: "${mapping.anchor_term}"`
        : "Saved. (Anchor not detected — use Re-detect, or check Document AI credentials.)";
      const verifyFlagged = label.verify_with_other_document || form.verify_with_other_document;
      if (verifyFlagged) {
        message += " This label is flagged for cross-document verification — link it on another document in the Cross-Document Linker.";
      }
      setNotice(message);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to save the crop.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMapping(id) {
    setBusyMappingId(id);
    try {
      await deleteFieldMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Failed to delete the crop.");
    } finally {
      setBusyMappingId(null);
    }
  }

  async function redetect(id) {
    setBusyMappingId(id);
    setError(null);
    try {
      const updated = await redetectAnchor(id);
      setMappings((prev) => prev.map((m) => (m.id === id ? updated : m)));
      setNotice(
        updated.anchor_term
          ? `Anchor detected: "${updated.anchor_term}"`
          : "Document AI ran but found no nearby label text."
      );
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Anchor detection failed.");
    } finally {
      setBusyMappingId(null);
    }
  }

  // ---- Template picker view (no ?template= in the URL) ----
  if (!templateIdParam) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Interactive Bounding Box Cropper</h1>
        <p className="text-gray-600 mb-4 text-sm">Pick a template to start cropping fields.</p>
        <div className="flex gap-3 items-end mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
            <select
              value={pickerTenantId}
              onChange={(e) => setPickerTenantId(e.target.value)}
              className="w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {tenants.length === 0 && <option value="">No tenants yet</option>}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        {pickerTemplates.length === 0 ? (
          <p className="text-sm text-gray-400">
            No templates for this tenant — upload one in the{" "}
            <Link to="/super-admin/template-uploader" className="text-indigo-600 hover:underline">
              Template Reference Uploader
            </Link>.
          </p>
        ) : (
          <ul className="space-y-2">
            {pickerTemplates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSearchParams({ template: String(t.id) })}
                  className="text-indigo-600 hover:underline text-sm"
                >
                  {t.name} ({t.document_type}, {t.page_count} page{t.page_count > 1 ? "s" : ""})
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Link to="/super-admin" className="inline-block mt-6 text-sm text-indigo-600 hover:underline">
          &larr; Back to Super Admin Panel
        </Link>
      </div>
    );
  }

  // ---- Cropper view ----
  return (
    <div className="max-w-7xl mx-auto p-6">
      <p className="text-sm text-indigo-500 font-medium mb-1">Super Admin Panel</p>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Bounding Box Cropper{template ? ` — ${template.name}` : ""}
        </h1>
        {template && template.page_count > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-gray-600">Page {page} / {template.page_count}</span>
            <button
              disabled={page >= template.page_count}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Click and drag on the document to draw a box around a value (e.g. the invoice number itself, not its label).
      </p>

      {notice && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drawing canvas */}
        <div className="lg:col-span-2">
          {template && (
            <div
              ref={imgWrapRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => drawing && onMouseUp()}
              className="relative select-none cursor-crosshair rounded-xl border border-gray-300 overflow-hidden bg-gray-100"
            >
              <img
                src={pageImageUrl(template.id, page)}
                alt={`Page ${page}`}
                className="w-full block pointer-events-none"
                draggable={false}
              />
              {/* Existing crops on this page */}
              {pageMappings.map((m) => (
                <div
                  key={m.id}
                  className="absolute border-2 rounded-sm"
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                    width: `${m.width * 100}%`,
                    height: `${m.height * 100}%`,
                    borderColor: COLORS[m.color] || "#6366f1",
                    backgroundColor: `${COLORS[m.color] || "#6366f1"}22`,
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 text-[10px] font-semibold px-1 rounded text-white whitespace-nowrap"
                    style={{ backgroundColor: COLORS[m.color] || "#6366f1" }}
                  >
                    {labelById[m.label_id]?.field_name || `label ${m.label_id}`}
                  </span>
                </div>
              ))}
              {/* Draft box while drawing / awaiting save */}
              {draft && (
                <div
                  className="absolute border-2 border-dashed border-indigo-600 bg-indigo-500/10 rounded-sm"
                  style={{
                    left: `${Math.min(draft.x0, draft.x1) * 100}%`,
                    top: `${Math.min(draft.y0, draft.y1) * 100}%`,
                    width: `${Math.abs(draft.x1 - draft.x0) * 100}%`,
                    height: `${Math.abs(draft.y1 - draft.y0) * 100}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Sidebar: crops on this template */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Mapped fields ({mappings.length})
          </h2>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {mappings.length === 0 && (
              <p className="text-sm text-gray-400">No crops yet — draw a box on the document.</p>
            )}
            {mappings.map((m) => {
              const label = labelById[m.label_id];
              return (
                <div key={m.id} className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[m.color] || "#6366f1" }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {label?.field_name || `label ${m.label_id}`}
                    </span>
                    <span className="text-xs text-gray-400">p.{m.page_number}</span>
                    {label?.verify_with_other_document && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-medium">
                        cross-doc verify
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Anchor:</span>{" "}
                    {m.anchor_term || <span className="text-gray-400">not detected</span>}
                  </p>
                  {m.generated_prompt && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-3" title={m.generated_prompt}>
                      <span className="font-medium">Prompt:</span> {m.generated_prompt}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => redetect(m.id)}
                      disabled={busyMappingId === m.id}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
                    >
                      {busyMappingId === m.id ? "Working…" : "Re-detect anchor"}
                    </button>
                    <button
                      onClick={() => removeMapping(m.id)}
                      disabled={busyMappingId === m.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Link to="/super-admin" className="inline-block mt-6 text-sm text-indigo-600 hover:underline">
        &larr; Back to Super Admin Panel
      </Link>

      {/* Label modal — opens after a box is drawn */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Create Field from Crop</h2>
            <p className="text-xs text-gray-500 mb-4">
              Saving runs Document AI on this page to detect the anchor label near your box.
            </p>
            <form onSubmit={saveMapping} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                <input
                  required
                  type="text"
                  list="existing-labels"
                  placeholder="e.g. invoice_no"
                  value={form.field_name}
                  onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="existing-labels">
                  {labels.map((l) => (
                    <option key={l.id} value={l.field_name} />
                  ))}
                </datalist>
                {labels.some(
                  (l) => l.field_name.toLowerCase() === form.field_name.trim().toLowerCase()
                ) && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Existing label — this crop will be linked to it.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
                  <select
                    value={form.data_type}
                    onChange={(e) => setForm({ ...form, data_type: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {DATA_TYPES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Box Color</label>
                  <div className="flex gap-2 pt-1.5">
                    {Object.entries(COLORS).map(([key, hex]) => (
                      <button
                        key={key}
                        type="button"
                        title={key}
                        onClick={() => setForm({ ...form, color: key })}
                        className={`w-6 h-6 rounded-full border-2 ${
                          form.color === key ? "border-gray-900 scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                />
                Is Required Field
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.verify_with_other_document}
                  onChange={(e) =>
                    setForm({ ...form, verify_with_other_document: e.target.checked })
                  }
                />
                <span>
                  <span className="font-medium">Verify with other document?</span>
                  <br />
                  <span className="text-xs text-amber-800">
                    If checked, this label's value will be cross-checked against another
                    document (e.g. BL weight vs. Packing List weight) during extraction.
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setDraft(null); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Saving… (running Document AI)" : "Save Field"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
