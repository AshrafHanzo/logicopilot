import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import * as usersApi from "../../api/users";
import * as jobsApi from "../../api/jobs";
import type { User } from "../../types/auth";

export function CreateOperatorModal({
  open,
  onClose,
  onCreated,
  editUser = null,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  editUser?: User | null;
}) {
  const isEdit = !!editUser;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [templates, setTemplates] = useState<jobsApi.AvailableGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Operators can only run APPROVED templates.
    jobsApi
      .listAvailableGroups()
      .then((gs) => setTemplates(gs.filter((g) => g.status === "approved")))
      .catch(() => setTemplates([]));
    if (editUser) {
      setFullName(editUser.full_name);
      setEmail(editUser.email);
      setPassword("");
      usersApi.getUserTemplates(editUser.id).then(setSelected).catch(() => setSelected([]));
    } else {
      setFullName("");
      setEmail("");
      setPassword("");
      setSelected([]);
    }
    setError(null);
  }, [open, editUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isEdit && editUser) {
        await usersApi.updateUser(editUser.id, {
          full_name: fullName,
          template_ids: selected,
          ...(password ? { password } : {}),
        });
      } else {
        await usersApi.createUser({ email, password, full_name: fullName, role: "operator", template_ids: selected });
      }
      onCreated();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Could not save operator.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Operator" : "New Operator"}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Smith" required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@company.com" required disabled={isEdit} />
        <Input
          label={isEdit ? "New password (leave blank to keep current)" : "Temporary password"}
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep" : "At least 8 characters"}
          minLength={isEdit ? undefined : 8}
          required={!isEdit}
        />

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Templates this operator can use</p>
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400">No approved templates yet — approve one under Data Transformation first.</p>
          ) : (
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {templates.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={(e) => setSelected((arr) => (e.target.checked ? [...arr, t.id] : arr.filter((x) => x !== t.id)))}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-400">Leave all unchecked to allow every approved template.</p>
        </div>

        {error && <Alert>{error}</Alert>}
        <Button type="submit" isLoading={isSubmitting} className="mt-1">
          {isEdit ? "Save changes" : "Create operator"}
        </Button>
      </form>
    </Modal>
  );
}
