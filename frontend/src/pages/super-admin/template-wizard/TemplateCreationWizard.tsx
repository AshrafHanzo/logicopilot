import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AppShell } from "../../../components/AppShell";
import * as reviewsApi from "../../../api/reviews";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Alert } from "../../../components/ui/Alert";
import * as tenantsApi from "../../../api/tenants";
import * as api from "../../../api/onboarding";
import type { Tenant } from "../../../types/tenant";
import type { DemoResult, Mark, TemplateGroupDetail } from "../../../types/onboarding";
import { DOC_TYPES, MARK_COLORS } from "../../../types/onboarding";
import { MarkCanvas, type DraftBox } from "./MarkCanvas";

const STEPS = ["Declare", "Upload", "Mark & Label", "Prompts", "Demo", "Correct"];

function errText(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data?.detail;
    if (typeof d === "string") return d;
  }
  return fallback;
}

export function TemplateCreationWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [editing, setEditing] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  // Step 1
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [decls, setDecls] = useState([{ name: "", doc_type: "BL" }]);

  // Shared
  const [group, setGroup] = useState<TemplateGroupDetail | null>(null);
  const [activeDocId, setActiveDocId] = useState<string>("");

  // Step 2
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Step 3 — label modal + cross-doc queue
  const [pendingBox, setPendingBox] = useState<DraftBox | null>(null);
  const [labelName, setLabelName] = useState("");
  const [markColor, setMarkColor] = useState("red");
  const [verify, setVerify] = useState(false);
  const [crossPopup, setCrossPopup] = useState<{ sourceMarkId: string; label: string } | null>(null);
  const [crossTargets, setCrossTargets] = useState<string[]>([]);

  // Step 5 / 6
  const [demo, setDemo] = useState<DemoResult | null>(null);
  const [testDocId, setTestDocId] = useState("");
  const [testResult, setTestResult] = useState<DemoResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [correcting, setCorrecting] = useState<Mark | null>(null);
  const [correctionText, setCorrectionText] = useState("");

  useEffect(() => {
    const editId = searchParams.get("edit");
    const rev = searchParams.get("review");
    if (editId) {
      // Editing an existing template (e.g. from the inbox): load it and jump
      // straight into Mark & Label — no re-declaring or re-uploading.
      setEditing(true);
      setReviewId(rev);
      api
        .getGroup(editId)
        .then((g) => {
          setGroup(g);
          setActiveDocId(g.documents[0]?.id ?? "");
          setStep(3);
        })
        .catch(() => setError("Failed to load the template to edit."));
    } else {
      tenantsApi
        .listTenants()
        .then((rows) => {
          setTenants(rows);
          if (rows[0]) setTenantId(rows[0].id);
        })
        .catch(() => setError("Failed to load tenants — is the backend running?"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The stepper is clickable once a template exists (created or being edited),
  // so you can jump directly to the stage you need instead of walking every step.
  function goToStep(n: number) {
    if (n === step) return;
    if (group && n >= 2) setStep(n);
    else if (!group && n === 1) setStep(1);
  }

  const activeDoc = useMemo(
    () => group?.documents.find((d) => d.id === activeDocId) ?? null,
    [group, activeDocId],
  );

  async function reloadGroup(id: string) {
    const g = await api.getGroup(id);
    setGroup(g);
    return g;
  }

  // ---- Step 1 ----
  async function submitDeclare() {
    setError(null);
    const documents = decls.map((d) => ({ name: d.name.trim(), doc_type: d.doc_type })).filter((d) => d.name);
    if (!tenantId) return setError("Pick a customer/tenant first.");
    if (!groupName.trim()) return setError("Give this template set a name.");
    if (documents.length === 0) return setError("Add at least one document.");
    setBusy(true);
    try {
      const g = await api.createGroup({ tenant_id: tenantId, name: groupName.trim(), documents });
      setGroup(g);
      setActiveDocId(g.documents[0]?.id ?? "");
      setStep(2);
    } catch (err) {
      setError(errText(err, "Could not create the template set."));
    } finally {
      setBusy(false);
    }
  }

  // ---- Step 2 ----
  async function handleUpload(docId: string, file: File | null | undefined) {
    if (!file || !group) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      setError("Only PDF, PNG, or JPG files are allowed.");
      return;
    }
    setError(null);
    setUploadingId(docId);
    try {
      await api.uploadDocument(docId, file);
      await reloadGroup(group.id);
    } catch (err) {
      setError(errText(err, "Upload failed."));
    } finally {
      setUploadingId(null);
    }
  }

  const allUploaded = !!group && group.documents.every((d) => d.is_uploaded);

  // ---- Step 3 ----
  function openLabelModal(box: DraftBox) {
    setPendingBox(box);
    setLabelName("");
    setVerify(false);
    setMarkColor("red");
  }

  async function saveMark() {
    if (!pendingBox || !activeDoc || !group) return;
    setBusy(true);
    setError(null);
    try {
      const mark = await api.createMark(activeDoc.id, {
        label_name: labelName.trim(),
        page_number: 1,
        x: pendingBox.x,
        y: pendingBox.y,
        width: pendingBox.width,
        height: pendingBox.height,
        color: markColor,
        verify_with_other_document: verify,
      });

      if (verify) {
        // Flagged for cross-doc: ask which other documents it also appears in.
        // (No re-cropping — we just link and pull it by meaning on those docs.)
        setCrossPopup({ sourceMarkId: mark.id, label: mark.label_name });
        setCrossTargets([]);
      }

      setPendingBox(null);
      await reloadGroup(group.id);
    } catch (err) {
      setError(errText(err, "Could not save the mark."));
      setPendingBox(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCrossTargets() {
    if (!crossPopup || crossTargets.length === 0) {
      setCrossPopup(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Link the field to the chosen documents — backend finds it there by meaning.
      await api.linkFieldToDocuments(crossPopup.sourceMarkId, { target_document_ids: crossTargets });
      if (group) await reloadGroup(group.id);
    } catch (err) {
      setError(errText(err, "Could not link the field across documents."));
    } finally {
      setBusy(false);
      setCrossPopup(null);
      setCrossTargets([]);
    }
  }

  async function removeMark(markId: string) {
    if (!group) return;
    setBusy(true);
    try {
      await api.deleteMark(markId);
      await reloadGroup(group.id);
    } catch (err) {
      setError(errText(err, "Could not delete the mark."));
    } finally {
      setBusy(false);
    }
  }

  const allMarks = useMemo(() => group?.documents.flatMap((d) => d.marks) ?? [], [group]);
  const docNameByMarkId = useMemo(() => {
    const map = new Map<string, string>();
    group?.documents.forEach((d) => d.marks.forEach((m) => map.set(m.id, d.name)));
    return map;
  }, [group]);

  // ---- Step 5 ----
  async function runDemo(docId: string) {
    setBusy(true);
    setError(null);
    try {
      setDemo(await api.demoExtract(docId));
    } catch (err) {
      setError(errText(err, "Demo run failed."));
    } finally {
      setBusy(false);
    }
  }

  async function runTestExtract(file: File | null | undefined) {
    if (!file || !testDocId) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      setError("Only PDF, PNG, or JPG files are allowed.");
      return;
    }
    setError(null);
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await api.testExtract(testDocId, file));
    } catch (err) {
      setError(errText(err, "Test extraction failed."));
    } finally {
      setTesting(false);
    }
  }

  async function finish() {
    if (!group) return;
    setFinalizing(true);
    setError(null);
    try {
      await api.finalizeGroup(group.id);
      // If we came from an inbox change-request, mark it resolved.
      if (reviewId) {
        try {
          await reviewsApi.resolveReview(reviewId);
        } catch {
          /* non-fatal */
        }
      }
      setSavedOpen(true);
    } catch (err) {
      setError(errText(err, "Could not save the template set."));
    } finally {
      setFinalizing(false);
    }
  }

  // ---- Step 6 ----
  async function applyCorrection() {
    if (!correcting || !group) return;
    setBusy(true);
    setError(null);
    try {
      await api.correctMark(correcting.id, correctionText.trim());
      await reloadGroup(group.id);
      setCorrecting(null);
      setCorrectionText("");
    } catch (err) {
      setError(errText(err, "Could not apply the correction."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Customer with Template Creation" subtitle="Onboard a customer's documents step by step.">
      {/* Stepper */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n === step ? "current" : n < step ? "done" : "todo";
          const clickable = (group && n >= 2) || (!group && n === 1);
          return (
            <div key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToStep(n)}
                disabled={!clickable}
                title={clickable ? `Go to ${label}` : undefined}
                className={`flex items-center gap-2 rounded-lg px-1 py-0.5 ${clickable ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : "cursor-default"}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    state === "current"
                      ? "bg-indigo-600 text-white"
                      : state === "done"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {n}
                </span>
                <span className={`text-sm ${n === step ? "font-semibold text-slate-900 dark:text-slate-50" : "text-slate-500"}`}>
                  {label}
                </span>
              </button>
              {n < STEPS.length && <span className="mx-1 text-slate-300 dark:text-slate-700">→</span>}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
          Editing an existing template — click any step above to jump straight there. No need to re-upload or re-declare. Changes save when you click <b>Done</b>.
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* STEP 1 — Declare */}
      {step === 1 && (
        <Card className="max-w-2xl p-6">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-50">Declare the documents</h2>
          <div className="flex flex-col gap-4">
            <Select label="Customer / Tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
              {tenants.length === 0 && <option value="">No tenants yet</option>}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Input label="Template set name" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Import Shipment Set" />
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Documents in this set</p>
              <div className="flex flex-col gap-2">
                {decls.map((d, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label={`Document ${i + 1}`}
                        value={d.name}
                        onChange={(e) => setDecls((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                        placeholder="e.g. BL, Invoice, Packing List"
                      />
                    </div>
                    <select
                      value={d.doc_type}
                      onChange={(e) => setDecls((arr) => arr.map((x, j) => (j === i ? { ...x, doc_type: e.target.value } : x)))}
                      className="mb-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {decls.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setDecls((arr) => arr.filter((_, j) => j !== i))}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setDecls((arr) => [...arr, { name: "", doc_type: "Custom" }])}>
                + Add document
              </Button>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={submitDeclare} isLoading={busy}>Next: Upload →</Button>
          </div>
        </Card>
      )}

      {/* STEP 2 — Upload */}
      {step === 2 && group && (
        <Card className="max-w-2xl p-6">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Upload a sample of each document</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">
            Add one example file per document so the AI can learn its layout. PDF, PNG, or JPG.
          </p>
          <div className="flex flex-col gap-4">
            {group.documents.map((d) => {
              const isUploading = uploadingId === d.id;
              return (
                <div key={d.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {d.doc_type}
                    </span>
                  </div>

                  {d.is_uploaded ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Uploaded · {d.page_count} page{d.page_count === 1 ? "" : "s"}
                      </span>
                      <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">
                        Replace
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => handleUpload(d.id, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => { e.preventDefault(); setDragOverId(d.id); }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => { e.preventDefault(); setDragOverId(null); handleUpload(d.id, e.dataTransfer.files?.[0]); }}
                      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                        dragOverId === d.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                          : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isUploading ? (
                        <span className="flex items-center gap-2 text-sm font-medium text-indigo-600">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Uploading &amp; rendering pages…
                        </span>
                      ) : (
                        <>
                          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6H16a5 5 0 011 9.9M12 12v8m0-8l-3 3m3-3l3 3" />
                          </svg>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            Click to choose a file <span className="text-slate-400">or drag it here</span>
                          </span>
                          <span className="text-xs text-slate-400">PDF, PNG, or JPG</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => handleUpload(d.id, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
            <div className="flex items-center gap-3">
              {!allUploaded && <span className="text-xs text-slate-400">Upload all documents to continue</span>}
              <Button onClick={() => setStep(3)} disabled={!allUploaded}>Next: Mark &amp; Label →</Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 3 — Mark & Label */}
      {step === 3 && group && activeDoc && (
        <div>
          <div className="mb-4 flex gap-2">
            {group.documents.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDocId(d.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  d.id === activeDocId
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {d.name} <span className="text-xs opacity-70">({d.marks.length})</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MarkCanvas
                documentId={activeDoc.id}
                page={1}
                marks={activeDoc.marks}
                labelForMark={(m) => m.label_name}
                onDraw={openLabelModal}
                disabled={busy}
              />
              <p className="mt-2 text-xs text-slate-500">Drag a box over a value (e.g. the BL number itself, not its caption).</p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">Marks on {activeDoc.name}</h3>
              <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
                {activeDoc.marks.length === 0 && <p className="text-sm text-slate-400">No marks yet.</p>}
                {activeDoc.marks.map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: MARK_COLORS[m.color] }} />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.label_name}</span>
                      {m.verify_with_other_document && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">cross-doc</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Anchor: {m.detected_anchor ?? "—"}</p>
                    <button onClick={() => removeMark(m.id)} className="mt-1 text-xs text-rose-600 hover:underline">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={() => setStep(4)} disabled={allMarks.length === 0}>Next: Prompts →</Button>
          </div>
        </div>
      )}

      {/* STEP 4 — Prompts review */}
      {step === 4 && group && (
        <div>
          <p className="mb-4 text-sm text-slate-500">Each mark was saved as a system prompt that researches how the field appears across documents.</p>
          <div className="flex flex-col gap-3">
            {allMarks.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{m.label_name}</span>
                  <span className="text-xs text-slate-400">on {docNameByMarkId.get(m.id)}</span>
                </div>
                <p className="text-xs text-slate-500">Detected anchor: {m.detected_anchor ?? "—"} · example: {m.example_value ?? "—"}</p>
                {m.anchor_variations && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.anchor_variations.map((v) => (
                      <span key={v} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{v}</span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400"><b>Prompt:</b> {m.extraction_prompt}</p>
              </Card>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(3)}>← Back</Button>
            <Button onClick={() => { setStep(5); setTestDocId(group.documents[0]?.id ?? ""); if (group.documents[0]) runDemo(group.documents[0].id); }}>Next: Demo →</Button>
          </div>
        </div>
      )}

      {/* STEP 5 — Demo */}
      {step === 5 && group && (
        <div>
          <p className="mb-4 text-sm text-slate-500">Confirm the config works — first on your reference docs, then on a real unseen document.</p>

          <Card className="mb-6 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Reference documents</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {group.documents.map((d) => (
                <Button key={d.id} size="sm" variant={demo?.document_id === d.id ? "primary" : "secondary"} onClick={() => runDemo(d.id)} isLoading={busy && demo?.document_id !== d.id}>
                  Run on {d.name}
                </Button>
              ))}
            </div>
            {demo && demo.results.length === 0 && <p className="text-sm text-slate-400">No marks on this document.</p>}
            {demo?.results.map((r) => (
              <div key={r.mark_id} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{r.label_name}</span>
                <span className="text-sm text-slate-900 dark:text-slate-100">{r.extracted_value ?? <span className="text-rose-500">not found</span>}</span>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-50">Test on an unseen document</h3>
            <p className="mb-3 text-xs text-slate-500">Upload a different real document to check the prompts still pull the right values.</p>
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Which document?</label>
                <select
                  value={testDocId}
                  onChange={(e) => { setTestDocId(e.target.value); setTestResult(null); }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {group.documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                {testing ? "Extracting…" : "Upload test file"}
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={testing} onChange={(e) => runTestExtract(e.target.files?.[0])} />
              </label>
            </div>
            {testResult && (
              <>
                <div className="mb-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  {testResult.results.map((r) => (
                    <div key={r.mark_id} className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800/60">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{r.label_name}</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.extracted_value ?? <span className="text-rose-500">not found</span>}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Do these look right?</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">✓ Looks correct</span>
                  <Button size="sm" variant="secondary" onClick={() => setStep(6)}>✗ Something's wrong — fix a field</Button>
                </div>
              </>
            )}
          </Card>

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(4)}>← Back</Button>
            <Button onClick={() => setStep(6)}>Next: Correct →</Button>
          </div>
        </div>
      )}

      {/* STEP 6 — Correct / train */}
      {step === 6 && group && (
        <div>
          <p className="mb-4 text-sm text-slate-500">Click a field to add a correction. It refines that field's prompt, then re-run the demo to recheck.</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">Fields</h3>
              {allMarks.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setCorrecting(m); setCorrectionText(m.correction_prompt ?? ""); }}
                  className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                    correcting?.id === m.id ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{m.label_name} <span className="text-xs text-slate-400">({docNameByMarkId.get(m.id)})</span></span>
                  {m.correction_prompt && <span className="text-xs text-emerald-600">trained</span>}
                </button>
              ))}
            </Card>
            <Card className="p-4">
              {!correcting && <p className="text-sm text-slate-400">Select a field to correct.</p>}
              {correcting && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Correct “{correcting.label_name}”</h3>
                  <p className="text-xs text-slate-500">Current prompt: {correcting.extraction_prompt}</p>
                  <textarea
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    rows={4}
                    placeholder="e.g. The value is always a 4-letter carrier code followed by 7 digits. Ignore any 'COPY' watermark."
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={applyCorrection} isLoading={busy} disabled={!correctionText.trim()}>Apply &amp; retrain</Button>
                    <Button size="sm" variant="secondary" onClick={() => group && runDemo(correcting.document_id)}>Recheck</Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep(5)}>← Back</Button>
            <Button onClick={finish} isLoading={finalizing}>Done — save template set</Button>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      <Modal open={savedOpen} onClose={() => setSavedOpen(false)} title="Template set saved ✓">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            “{group?.name}” has been saved and is now available to run in <b>Jobs</b>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSavedOpen(false)}>Close</Button>
            <Button onClick={() => navigate("/jobs")}>Go to Jobs</Button>
          </div>
        </div>
      </Modal>

      {/* Label modal (after drawing a box) */}
      <Modal open={pendingBox !== null} onClose={() => setPendingBox(null)} title="Name this field">
        <div className="flex flex-col gap-4">
          <Input
            label="Field name"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            placeholder="e.g. bl_number"
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Box colour</p>
            <div className="flex gap-2">
              {Object.entries(MARK_COLORS).map(([key, hex]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMarkColor(key)}
                  className={`h-6 w-6 rounded-full border-2 ${markColor === key ? "border-slate-900 dark:border-white" : "border-transparent"}`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
            <input type="checkbox" className="mt-0.5" checked={verify} onChange={(e) => setVerify(e.target.checked)} />
            <span className="text-amber-800 dark:text-amber-300">
              <b>Present in another document?</b><br />
              <span className="text-xs">Tick to cross-verify this value against your other documents (you'll pick which — no re-cropping needed).</span>
            </span>
          </label>
          <Button onClick={saveMark} isLoading={busy} disabled={!labelName.trim()}>Save field</Button>
        </div>
      </Modal>

      {/* Cross-doc popup — choose which documents this field also appears in */}
      <Modal open={crossPopup !== null} onClose={() => setCrossPopup(null)} title={`Where else does “${crossPopup?.label}” appear?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-500">Select every document this value also appears in — we'll find it there automatically (no need to crop again).</p>
          {group?.documents
            .filter((d) => d.id !== activeDocId)
            .map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={crossTargets.includes(d.id)}
                  onChange={(e) =>
                    setCrossTargets((arr) => (e.target.checked ? [...arr, d.id] : arr.filter((x) => x !== d.id)))
                  }
                />
                {d.name} <span className="text-xs text-slate-400">({d.doc_type})</span>
              </label>
            ))}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCrossPopup(null)}>Skip</Button>
            <Button size="sm" onClick={confirmCrossTargets} isLoading={busy} disabled={crossTargets.length === 0}>
              Link {crossTargets.length || ""} document{crossTargets.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
