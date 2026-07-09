export type Role = "super_admin" | "tenant_admin" | "operator";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  tenant_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
}
