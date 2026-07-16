import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { DataTable, type Column } from "../../components/ui/DataTable";
import * as onboardingApi from "../../api/onboarding";
import * as tenantsApi from "../../api/tenants";
import type { TemplateGroup } from "../../types/onboarding";
import type { Tenant } from "../../types/tenant";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ready: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  changes_requested: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
};

export function TemplateListPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [g, t] = await Promise.all([onboardingApi.listGroups(), tenantsApi.listTenants()]);
      setGroups(g);
      setTenants(t);
    } catch {
      setError("Failed to load templates. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const tenantName = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await onboardingApi.deleteGroup(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch {
      setError("Could not delete that template.");
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<TemplateGroup>[] = [
    { header: "Template", render: (g) => <span className="font-medium text-slate-900 dark:text-slate-100">{g.name}</span> },
    { header: "Tenant", render: (g) => tenantName.get(g.tenant_id) ?? "—" },
    {
      header: "Status",
      render: (g) => (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[g.status] ?? STATUS_STYLE.draft}`}>
          {g.status.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      header: "",
      className: "text-right",
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/super-admin/template-creation?edit=${g.id}`)}>
            View / Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(g)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Template List" subtitle="Every template you've configured. Open one to view its crops and edit.">
      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}
      <Card>
        {!loading && (
          <DataTable
            columns={columns}
            rows={groups}
            keyFor={(g) => g.id}
            emptyMessage="No templates yet — create one under Customer with Template Creation."
          />
        )}
      </Card>

      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete template?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Delete <b>{deleteTarget?.name}</b>? This permanently removes the template, its documents and crops,
            cross-document links, operator assignments, and any jobs run from it. This can't be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={deleting}>Delete template</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
