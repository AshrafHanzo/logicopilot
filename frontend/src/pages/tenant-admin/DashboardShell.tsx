import { useEffect, useState } from "react";
import axios from "axios";
import { AppShell } from "../../components/AppShell";
import { Button } from "../../components/ui/Button";
import { Card, StatCard } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/Badge";
import { CreateOperatorModal } from "./CreateOperatorModal";
import { useAuth } from "../../auth/useAuth";
import * as usersApi from "../../api/users";
import * as tenantsApi from "../../api/tenants";
import type { User } from "../../types/auth";

export function TenantAdminDashboard() {
  const { user } = useAuth();
  const [operators, setOperators] = useState<User[]>([]);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOperator, setEditOperator] = useState<User | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [userList, tenant] = await Promise.all([
        usersApi.listUsers(),
        user?.tenant_id ? tenantsApi.getTenant(user.tenant_id) : Promise.resolve(null),
      ]);
      setOperators(userList.filter((u) => u.role === "operator"));
      setTenantName(tenant?.name ?? null);
    } catch {
      setError("Failed to load data. Try refreshing the page.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggleActive(operator: User) {
    try {
      await usersApi.setUserActive(operator.id, !operator.is_active);
      refresh();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Could not update that account.");
      }
    }
  }

  const activeCount = operators.filter((o) => o.is_active).length;

  const columns: Column<User>[] = [
    { header: "Name", render: (u) => <span className="font-medium text-slate-900 dark:text-slate-100">{u.full_name}</span> },
    { header: "Email", render: (u) => u.email },
    { header: "Status", render: (u) => <StatusBadge isActive={u.is_active} /> },
    {
      header: "",
      className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setEditOperator(u); setModalOpen(true); }}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
            {u.is_active ? "Disable" : "Enable"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell title="Tenant Admin" subtitle={tenantName ? `Managing operators for ${tenantName}.` : "Manage your operators."}>
      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Operators" value={operators.length} />
        <StatCard label="Active" value={activeCount} />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Operators</h2>
          <Button size="sm" onClick={() => { setEditOperator(null); setModalOpen(true); }}>
            + New Operator
          </Button>
        </div>
        {!isLoading && (
          <DataTable
            columns={columns}
            rows={operators}
            keyFor={(u) => u.id}
            emptyMessage="No operators yet — create the first login for your team."
          />
        )}
      </Card>

      <CreateOperatorModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditOperator(null);
        }}
        editUser={editOperator}
        onCreated={() => {
          setModalOpen(false);
          setEditOperator(null);
          refresh();
        }}
      />
    </AppShell>
  );
}
