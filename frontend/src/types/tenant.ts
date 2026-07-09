export interface Tenant {
  id: string;
  name: string;
  region: string | null;
  currency: string | null;
  is_active: boolean;
}
