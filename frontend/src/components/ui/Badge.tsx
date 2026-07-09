import type { Role } from "../../types/auth";

const ROLE_CLASSES: Record<Role, string> = {
  super_admin: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  tenant_admin: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  operator: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Tenant Admin",
  operator: "Operator",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_CLASSES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
      {isActive ? "Active" : "Disabled"}
    </span>
  );
}
