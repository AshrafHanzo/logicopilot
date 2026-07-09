import { useState, type FormEvent } from "react";
import axios from "axios";
import { Modal } from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import * as usersApi from "../../api/users";
import type { Tenant } from "../../types/tenant";

export function CreateTenantAdminModal({
  open,
  onClose,
  onCreated,
  tenants,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  tenants: Tenant[];
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await usersApi.createUser({ email, password, full_name: fullName, role: "tenant_admin", tenant_id: tenantId });
      reset();
      onCreated();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Could not create tenant admin.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New Tenant Admin"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Select label="Tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@company.com"
          required
        />
        <Input
          label="Temporary password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
        <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">
          Share this password with them directly — there's no email invite yet, so they'll need it from you.
        </p>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" isLoading={isSubmitting} className="mt-1">
          Create tenant admin
        </Button>
      </form>
    </Modal>
  );
}
