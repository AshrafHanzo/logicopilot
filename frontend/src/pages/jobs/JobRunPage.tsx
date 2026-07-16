import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import * as jobsApi from "../../api/jobs";
import { useAuth } from "../../auth/useAuth";
import type { JobDetail, JobFieldValue } from "../../types/jobs";

type TabKey = "documents" | "verification" | "entry" | "completed";
const STEPS: { key: TabKey; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "verification", label: "Verification" },
  { key: "entry", label: "ERP Entry" },
  { key: "completed", label: "Completed" },
];

function stepFromStatus(status: string): number {
  if (status === "completed") return 4;
  if (status === "extracted") return 3;
  return 1;
}

export function JobRunPage() {
  const { jobId = "" } = useParams();
  const { user } = useAuth();
  const readOnly = user?.role === "tenant_admin" || user?.role === "super_admin";

  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const didInit = useRef(false);

  async function load() {
    try {
      const j = await jobsApi.getJob(jobId);
      setJob(j);
      if (!didInit.current) {
        didInit.current = true;
        setActiveTab(STEPS[stepFromStatus(j.status) - 1].key);
      }
    } catch {
      setError("Failed to load the job.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function handleUpload(templateDocumentId: string, file: File | null | undefined) {
    if (!file) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      setError("Only PDF, PNG, or JPG files are allowed.");
      return;
    }
    setError(null);
    setUploadingId(templateDocumentId);
    try {
      setJob(await jobsApi.uploadJobDocument(jobId, templateDocumentId, file));
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Upload failed.");
    } finally {
      setUploadingId(null);
    }
  }

  async function runExtract() {
    setExtracting(true);
    setError(null);
    try {
      const j = await jobsApi.extractJob(jobId);
      setJob(j);
      setActiveTab("verification");
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function saveCorrection(fv: JobFieldValue) {
    const next = edits[fv.id];
    if (next === undefined || next === (fv.value ?? "")) return;
    setSavingId(fv.id);
    try {
      await jobsApi.correctFieldValue(fv.id, next);
      await load();
      setEdits((e) => {
        const { [fv.id]: _removed, ...rest } = e;
        return rest;
      });
    } catch {
      setError("Could not save the correction.");
    } finally {
      setSavingId(null);
    }
  }

  async function decideVerification(linkId: string, accept: boolean) {
    setError(null);
    try {
      setJob(await jobsApi.setVerificationDecision(jobId, linkId, accept));
    } catch {
      setError("Could not update that check.");
    }
  }

  async function submitEntry() {
    setSubmitting(true);
    setError(null);
    try {
      const j = await jobsApi.completeJob(jobId);
      setJob(j);
      setActiveTab("completed");
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Could not submit the entry.");
    } finally {
      setSubmitting(false);
    }
  }

  const allUploaded = !!job && job.documents.length > 0 && job.documents.every((d) => d.is_uploaded);
  const unresolved = job?.verifications.filter((v) => v.status !== "match" && !v.accepted).length ?? 0;
  const valuesByDoc = useMemo(() => {
    const map = new Map<string, JobFieldValue[]>();
    job?.field_values.forEach((fv) => {
      const arr = map.get(fv.document_name) ?? [];
      arr.push(fv);
      map.set(fv.document_name, arr);
    });
    return map;
  }, [job]);

  if (!job) {
    return (
      <AppShell title="Job">{error ? <Alert>{error}</Alert> : <p className="text-sm text-slate-400">Loading…</p>}</AppShell>
    );
  }

  const currentStep = stepFromStatus(job.status);
  const canOpen = (key: TabKey): boolean => {
    if (key === "documents") return true;
    if (key === "verification" || key === "entry") return job.status !== "draft";
    if (key === "completed") return job.status === "completed";
    return false;
  };

  return (
    <AppShell title={`Job · ${job.reference}`} subtitle={job.group_name}>
      <Link to="/jobs" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">← All jobs</Link>
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      {/* Progress stepper */}
      <Card className="mb-6 px-5 py-6">
        <h3 className="mb-6 text-xs font-medium uppercase tracking-wider text-slate-500">Job Progress</h3>
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, i) => {
            const n = i + 1;
            const done = n < currentStep;
            const current = n === currentStep;
            const clickable = canOpen(step.key);
            return (
              <div key={step.key} className="relative flex flex-1 flex-col items-center">
                {i < STEPS.length - 1 && (
                  <div
                    className={`absolute left-1/2 top-4 h-0.5 w-full ${done ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                    style={{ zIndex: 0 }}
                  />
                )}
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && setActiveTab(step.key)}
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : current
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900"
                  } ${activeTab === step.key ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900" : ""} ${clickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {done ? "✓" : n}
                </button>
                <span className={`mt-2 text-center text-xs ${current ? "font-semibold text-indigo-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---------------- Documents tab ---------------- */}
      {activeTab === "documents" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">Upload documents</h2>
            {!readOnly && (
              <Button size="sm" onClick={runExtract} isLoading={extracting} disabled={!allUploaded}>
                {job.status === "draft" ? "Run extraction" : "Re-run extraction"}
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {job.documents.map((d) => {
              const isUploading = uploadingId === d.template_document_id;
              return (
                <div key={d.id}>
                  <p className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {d.name} <span className="text-xs text-slate-400">({d.doc_type})</span>
                  </p>
                  {d.is_uploaded ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <span>✓ {d.page_count} page{d.page_count === 1 ? "" : "s"}</span>
                      {!readOnly && (
                        <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline">
                          Replace
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => handleUpload(d.template_document_id, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  ) : readOnly ? (
                    <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700">Not uploaded</div>
                  ) : (
                    <label
                      onDragOver={(e) => { e.preventDefault(); setDragOverId(d.template_document_id); }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => { e.preventDefault(); setDragOverId(null); handleUpload(d.template_document_id, e.dataTransfer.files?.[0]); }}
                      className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-3 py-4 text-center text-sm transition-colors ${
                        dragOverId === d.template_document_id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-300 bg-slate-50 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      {isUploading ? <span className="text-indigo-600">Uploading…</span> : <span className="text-slate-500">Click or drag a file (PDF, PNG, JPG)</span>}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={isUploading} onChange={(e) => handleUpload(d.template_document_id, e.target.files?.[0])} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {!allUploaded && !readOnly && <p className="mt-3 text-xs text-slate-400">Upload all documents, then run extraction.</p>}
        </Card>
      )}

      {/* ---------------- Verification tab ---------------- */}
      {activeTab === "verification" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-50">Document Cross-Verification</h2>
              <p className="text-xs text-slate-500">The same field compared across documents.</p>
            </div>
            {job.verifications.length > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${job.all_checks_passed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"}`}>
                {job.all_checks_passed ? "✓ All checks passed" : `${unresolved} to review`}
              </span>
            )}
          </div>
          {job.verifications.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No cross-document checks configured for this template.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-5 py-3">Field</th><th className="px-5 py-3">Source 1</th><th className="px-5 py-3">Source 2</th><th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {job.verifications.map((v) => {
                    const rowTint =
                      v.accepted || v.status === "match" ? ""
                      : v.status === "mismatch" ? "bg-rose-50/40 dark:bg-rose-500/5"
                      : v.status === "review" ? "bg-amber-50/40 dark:bg-amber-500/5"
                      : "bg-slate-50/60 dark:bg-slate-800/30"; // missing
                    const badge =
                      v.accepted ? { c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", t: "✓ Accepted" }
                      : v.status === "match" ? { c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", t: "✓ Match" }
                      : v.status === "mismatch" ? { c: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", t: "✗ Mismatch" }
                      : v.status === "review" ? { c: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", t: "≈ Review" }
                      : { c: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", t: "— Missing" };
                    const val = (x: string | null) =>
                      x ? <span className="text-slate-900 dark:text-slate-100">{x}</span> : <span className="italic text-slate-400">not found</span>;
                    const canAct = !readOnly && !v.accepted && (v.status === "review" || v.status === "mismatch");
                    return (
                      <tr key={v.link_id} className={`border-b border-slate-100 dark:border-slate-800/60 ${rowTint}`}>
                        <td className="px-5 py-3"><div className="font-medium text-slate-900 dark:text-slate-100">{v.field_label}</div><div className="text-xs text-slate-400">{v.source_document} vs {v.target_document}</div></td>
                        <td className="px-5 py-3"><div className="text-xs text-slate-400">{v.source_document}</div>{val(v.source_value)}</td>
                        <td className="px-5 py-3"><div className="text-xs text-slate-400">{v.target_document}</div>{val(v.target_value)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.c}`}>{badge.t}</span>
                            {canAct && (
                              <Button size="sm" variant="secondary" onClick={() => decideVerification(v.link_id, true)}>Accept</Button>
                            )}
                            {!readOnly && v.accepted && (
                              <button onClick={() => decideVerification(v.link_id, false)} className="text-xs text-slate-400 hover:underline">undo</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!readOnly && (
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setActiveTab("entry")}>Continue to ERP Entry →</Button>
            </div>
          )}
        </Card>
      )}

      {/* ---------------- ERP Entry tab ---------------- */}
      {activeTab === "entry" && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-50">ERP Entry</h2>
              <p className="text-xs text-slate-500">Review the extracted data, correct anything wrong, then submit the entry.</p>
            </div>
            {!readOnly && (
              <Button onClick={submitEntry} isLoading={submitting} disabled={job.status !== "extracted"}>
                Submit Entry
              </Button>
            )}
          </div>
          {job.status === "completed" && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              This entry has been submitted — the job is completed.
            </div>
          )}
          {[...valuesByDoc.entries()].map(([docName, values]) => (
            <div key={docName} className="mb-5 last:mb-0">
              <h3 className="mb-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{docName}</h3>
              <div className="flex flex-col gap-2">
                {values.map((fv) => {
                  const editing = edits[fv.id] !== undefined;
                  const shown = editing ? edits[fv.id] : (fv.value ?? "");
                  return (
                    <div key={fv.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-sm text-slate-500">{fv.label_name}</span>
                      <input
                        value={shown}
                        disabled={readOnly || job.status === "completed"}
                        onChange={(e) => setEdits((s) => ({ ...s, [fv.id]: e.target.value }))}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
                      />
                      {fv.corrected_value !== null && <span className="text-xs text-amber-600">corrected</span>}
                      {!readOnly && editing && shown !== (fv.value ?? "") && (
                        <Button size="sm" onClick={() => saveCorrection(fv)} isLoading={savingId === fv.id}>Save</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {job.field_values.length === 0 && <p className="text-sm text-slate-400">No fields extracted yet — run extraction on the Documents step.</p>}
        </Card>
      )}

      {/* ---------------- Completed tab ---------------- */}
      {activeTab === "completed" && (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Job completed</h2>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            The ERP entry for <b>{job.reference}</b> has been submitted. This job now shows as Completed on the dashboard.
          </p>
          <Link to="/jobs" className="text-sm text-indigo-600 hover:underline">← Back to all jobs</Link>
        </Card>
      )}
    </AppShell>
  );
}
