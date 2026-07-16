import { apiClient } from "./client";
import type { Tenant } from "../types/tenant";

export async function listTenants(): Promise<Tenant[]> {
  const response = await apiClient.get<Tenant[]>("/tenants");
  return response.data;
}

export async function getTenant(tenantId: string): Promise<Tenant> {
  const response = await apiClient.get<Tenant>(`/tenants/${tenantId}`);
  return response.data;
}

export async function createTenant(payload: {
  name: string;
  region?: string;
  currency?: string;
  admin_full_name?: string;
  admin_email?: string;
  admin_password?: string;
}): Promise<Tenant> {
  const response = await apiClient.post<Tenant>("/tenants", payload);
  return response.data;
}
