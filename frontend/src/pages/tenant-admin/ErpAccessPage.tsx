import { useState, type FormEvent } from "react";
import axios from "axios";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import * as reviewsApi from "../../api/reviews";

export function ErpAccessPage() {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await reviewsApi.submitErpAccess({ url, username, password });
      setUrl("");
      setUsername("");
      setPassword("");
      setDone(true);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.detail ?? "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="ERP Access" subtitle="Send your ERP endpoint and credentials to the Super Admin to wire up.">
      <Card className="max-w-lg p-6">
        {done && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            Sent ✓ — the Super Admin has received your ERP access details in their inbox.
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="ERP URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://erp.company.com/entry" required />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="erp-user" required />
          <Input label="Password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ERP password" required />
          <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">
            These go to the Super Admin so they can connect this ERP. Only send credentials you're authorized to share.
          </p>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" isLoading={submitting} className="mt-1">Send to Super Admin</Button>
        </form>
      </Card>
    </AppShell>
  );
}
