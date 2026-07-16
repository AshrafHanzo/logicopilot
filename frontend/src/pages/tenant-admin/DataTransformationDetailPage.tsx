import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Alert } from "../../components/ui/Alert";
import * as onboardingApi from "../../api/onboarding";
import * as reviewsApi from "../../api/reviews";
import type { Mark, TemplateGroupDetail } from "../../types/onboarding";
import { MarkCanvas } from "../super-admin/template-wizard/MarkCanvas";

export function DataTransformationDetailPage() {
  const { groupId = "" } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<TemplateGroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busyMark, setBusyMark] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMsg, setRejectMsg] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    onboardingApi
      .getGroup(groupId)
      .then((g) => {
        setGroup(g);
        const initial: Record<string, string> = {};
        g.documents.forEach((d) => d.marks.forEach((m) => (initial[m.id] = m.tenant_format_prompt ?? "")));
        setPrompts(initial);
      })
      .catch(() => setError("Failed to load the template."));
  }, [groupId]);

  const allMarks = useMemo(() => group?.documents.flatMap((d) => d.marks) ?? [], [group]);
  const docNameByMark = useMemo(() => {
    const map = new Map<string, string>();
    group?.documents.forEach((d) => d.marks.forEach((m) => map.set(m.id, d.name)));
    return map;
  }, [group]);

  async function checkField(mark: Mark) {
    setBusyMark(mark.id);
    setError(null);
    try {
      await reviewsApi.setFormatPrompt(mark.id, prompts[mark.id] ?? "");
      const formatted = await reviewsApi.formatCheck(mark.id, {
        value: mark.example_value,
        format_prompt: prompts[mark.id] ?? "",
      });
      setPreviews((p) => ({ ...p, [mark.id]: formatted }));
    } catch {
      setError("Could not run that field.");
    } finally {
      setBusyMark(null);
    }
  }

  async function checkAll() {
    for (const m of allMarks) {
      if (prompts[m.id]?.trim()) await checkField(m);
    }
  }

  async function approve() {
    setWorking(true);
    setError(null);
    try {
      // persist any format prompts first
      for (const m of allMarks) {
        if ((prompts[m.id] ?? "") !== (m.tenant_format_prompt ?? "")) {
          await reviewsApi.setFormatPrompt(m.id, prompts[m.id] ?? "");
        }
      }
      await reviewsApi.approveTemplate(groupId);
      setSavedOpen(true);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Could not approve.");
    } finally {
      setWorking(false);
    }
  }

  async function submitReject() {
    setWorking(true);
    setError(null);
    try {
      await reviewsApi.requestChanges(groupId, rejectMsg.trim());
      setRejectOpen(false);
      navigate("/tenant-admin/data-transformation");
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Could not send.");
    } finally {
      setWorking(false);
    }
  }

  if (!group) {
    return (
      <AppShell title="Configure Data Transformation">
        {error ? <Alert>{error}</Alert> : <p className="text-sm text-slate-400">Loading…</p>}
      </AppShell>
    );
  }

  return (
    <AppShell title={`Data Transformation · ${group.name}`} subtitle="Set how each field's value should be formatted, then approve for operators.">
      <Link to="/tenant-admin/data-transformation" className="mb-4 inline-block text-sm text-indigo-600 hover:underline">← All templates</Link>
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      {/* Documents the Super Admin uploaded, with the fields they marked */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-50">Documents (uploaded by Super Admin)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {group.documents.map((d) => (
            <div key={d.id}>
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                {d.name} <span className="text-xs text-slate-400">({d.doc_type})</span>
              </p>
              {d.is_uploaded ? (
                <MarkCanvas
                  documentId={d.id}
                  page={1}
                  marks={d.marks.filter((m) => m.page_number === 1)}
                  labelForMark={(m) => m.label_name}
                  onDraw={() => {}}
                  disabled
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700">
                  Not uploaded yet
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Fields &amp; formatting</h2>
        {allMarks.length === 0 && <Card className="p-6 text-sm text-slate-400">This template has no fields configured yet.</Card>}
        {allMarks.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Left: extracted value from the super admin's reference */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{m.label_name}</span>
                  <span className="text-xs text-slate-400">{docNameByMark.get(m.id)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Extracted value</p>
                <p className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {m.example_value ?? "—"}
                </p>
                {previews[m.id] !== undefined && (
                  <>
                    <p className="mt-2 text-xs text-emerald-600">After your format</p>
                    <p className="rounded-lg bg-emerald-50 px-3 py-1.5 font-mono text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {previews[m.id] || "—"}
                    </p>
                  </>
                )}
              </div>
              {/* Right: format prompt + per-field Check */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Format instruction</label>
                <textarea
                  rows={2}
                  value={prompts[m.id] ?? ""}
                  onChange={(e) => setPrompts((p) => ({ ...p, [m.id]: e.target.value }))}
                  placeholder="e.g. return the date as MM/DD/YYYY"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => checkField(m)} isLoading={busyMark === m.id}>
                  Check this field
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
        <Button variant="secondary" onClick={checkAll}>Check all</Button>
        <div className="flex gap-2">
          <Button variant="danger" onClick={() => setRejectOpen(true)}>Not approve</Button>
          <Button onClick={approve} isLoading={working}>Approve</Button>
        </div>
      </div>

      {/* Reject → message to super admin inbox */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Request changes from Super Admin">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">Tell the Super Admin what needs fixing. This goes to their inbox.</p>
          <textarea
            rows={4}
            value={rejectMsg}
            onChange={(e) => setRejectMsg(e.target.value)}
            placeholder="e.g. The bl_number field is picking the wrong value; please re-crop it."
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={submitReject} isLoading={working} disabled={!rejectMsg.trim()}>Send to Super Admin</Button>
          </div>
        </div>
      </Modal>

      {/* Approved confirmation */}
      <Modal open={savedOpen} onClose={() => setSavedOpen(false)} title="Template approved ✓">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            “{group.name}” is approved and now available to your operators in Jobs.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => navigate("/tenant-admin/data-transformation")}>Done</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
