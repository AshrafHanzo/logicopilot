import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";

export function OperatorDashboard() {
  return (
    <AppShell title="Operator" subtitle="Upload documents and let the AI take it from here.">
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Document upload is coming soon</h2>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          This is where you'll upload transaction files, review AI-extracted data, and submit automated web entries.
          It's the next module on the build plan.
        </p>
      </Card>
    </AppShell>
  );
}
