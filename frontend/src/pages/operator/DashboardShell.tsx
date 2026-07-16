import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import * as jobsApi from "../../api/jobs";
import type { Job } from "../../types/jobs";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  extracted: "Extracted",
  completed: "Completed",
};

export function OperatorDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi
      .listJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const total = jobs.length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const inProgress = jobs.filter((j) => j.status !== "completed").length;

  const columns: Column<Job>[] = [
    { header: "Reference", render: (j) => <span className="font-medium text-slate-900 dark:text-slate-100">{j.reference}</span> },
    {
      header: "Status",
      render: (j) => (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            j.status === "completed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : j.status === "extracted"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {STATUS_LABEL[j.status] ?? j.status}
        </span>
      ),
    },
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
      title="Operator"
      subtitle="Process transactions: upload, verify, and submit ERP entries."
      actions={<Button size="sm" onClick={() => navigate("/jobs")}>Go to Jobs</Button>}
    >
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Jobs" value={total} />
        <StatCard label="In Progress" value={inProgress} />
        <StatCard label="Completed" value={completed} />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Recent jobs</h2>
          <Button size="sm" onClick={() => navigate("/jobs")}>+ New / all jobs</Button>
        </div>
        {!loading && (
          <DataTable
            columns={columns}
            rows={jobs.slice(0, 8)}
            keyFor={(j) => j.id}
            emptyMessage="No jobs yet — go to Jobs to create your first one."
          />
        )}
      </Card>
    </AppShell>
  );
}
