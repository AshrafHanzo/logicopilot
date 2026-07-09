import { useState, type FormEvent } from "react";
import axios from "axios";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import * as tenantsApi from "../../api/tenants";

export function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [currency, setCurrency] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName("");
    setRegion("");
    setCurrency("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await tenantsApi.createTenant({ name, region: region || undefined, currency: currency || undefined });
      reset();
      onCreated();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Could not create tenant.");
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
      title="New Tenant"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input label="Company name" value={name} onChange={(e) => setName(e.target.value)} placeholder="4S Logistics" required />
        <Input label="Region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="IN" />
        <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" maxLength={3} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" isLoading={isSubmitting} className="mt-1">
          Create tenant
        </Button>
      </form>
    </Modal>
  );
}
