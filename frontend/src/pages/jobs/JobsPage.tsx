import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { Modal } from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { Alert } from "../../components/ui/Alert";
import { StatusBadge } from "../../components/ui/Badge";
import * as jobsApi from "../../api/jobs";
import type { Job } from "../../types/jobs";

export function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [groups, setGroups] = useState<jobsApi.AvailableGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setError(null);
    try {
      const [jobList, groupList] = await Promise.all([jobsApi.listJobs(), jobsApi.listAvailableGroups()]);
      setJobs(jobList);
      setGroups(groupList);
      if (groupList[0]) setGroupId(groupList[0].id);
    } catch {
      setError("Failed to load jobs. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const job = await jobsApi.createJob({ group_id: groupId, reference });
      setModalOpen(false);
      setReference("");
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Could not create the job.");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<Job>[] = [
    { header: "Reference", render: (j) => <span className="font-medium text-slate-900 dark:text-slate-100">{j.reference}</span> },
    { header: "Template set", render: (j) => groupName.get(j.group_id) ?? "—" },
    { header: "Status", render: (j) => <StatusBadge isActive={j.status === "extracted"} /> },
    {
      header: "",
      className: "text-right",
      render: (j) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/jobs/${j.id}`)}>
          Open →
        </Button>
      ),
    },
  ];

  return (
    <AppShell
      title="Jobs"
      subtitle="Upload a transaction's documents, extract, and cross-verify."
      actions={
        <Button size="sm" onClick={() => setModalOpen(true)} disabled={groups.length === 0}>
          + New Job
        </Button>
      }
    >
      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
        </div>
      )}
      {groups.length === 0 && !loading && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          No template sets available yet. A Super Admin needs to configure one in “Customer with Template Creation” first.
        </div>
      )}

      <Card>
        {!loading && (
          <DataTable
            columns={columns}
            rows={jobs}
            keyFor={(j) => j.id}
            emptyMessage="No jobs yet — create one to process a transaction."
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Job">
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <Select label="Template set (customer)" value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
          <Input label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. SHIP-2026-001" required />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" isLoading={submitting} className="mt-1">Create &amp; open</Button>
        </form>
      </Modal>
    </AppShell>
  );
}
