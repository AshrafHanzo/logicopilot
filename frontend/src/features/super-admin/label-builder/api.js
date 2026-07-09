import apiClient from "../../../api/client";

// Backend contract: backend/app/modules/super_admin/label_builder/schemas.py + routes.py

export async function listLabels(tenantId) {
  const { data } = await apiClient.get(`/tenants/${tenantId}/labels`);
  return data;
}

export async function createLabel(tenantId, payload) {
  const { data } = await apiClient.post(`/tenants/${tenantId}/labels`, payload);
  return data;
}

export async function updateLabel(labelId, payload) {
  const { data } = await apiClient.patch(`/labels/${labelId}`, payload);
  return data;
}

export async function deleteLabel(labelId) {
  await apiClient.delete(`/labels/${labelId}`);
}
