import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import * as jobsApi from "../../api/jobs";

export function DataTransformationPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<jobsApi.AvailableGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    jobsApi
      .listAvailableGroups()
      .then(setGroups)
      .catch(() => setError("Failed to load templates. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Data Transformation" subtitle="Templates the Super Admin configured for your company.">
      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {!loading && groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No templates yet. Ask your Super Admin to finish a "Customer with Template Creation" for your company.
          </p>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id} className="flex flex-col justify-between p-5">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-50">{g.name}</p>
              <p className="mt-1 text-xs text-slate-400">Configure how each field's value is formatted, then approve.</p>
            </div>
            <Button size="sm" className="mt-4" onClick={() => navigate(`/tenant-admin/data-transformation/${g.id}`)}>
              Open →
            </Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
