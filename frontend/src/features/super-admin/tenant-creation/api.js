import apiClient from "../../../api/client";

// Backend contract: backend/app/modules/super_admin/tenant_creation/schemas.py + routes.py

export async function listTenants() {
  const { data } = await apiClient.get("/tenants");
  return data;
}

export async function createTenant(payload) {
  const { data } = await apiClient.post("/tenants", payload);
  return data;
}
