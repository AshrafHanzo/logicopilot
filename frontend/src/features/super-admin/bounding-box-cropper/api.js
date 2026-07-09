import apiClient from "../../../api/client";

// Backend contract: backend/app/modules/super_admin/bounding_box_cropper/schemas.py + routes.py
// (plus template + label endpoints this page needs; duplicated here on purpose so the
// feature folder stays self-contained per the pluggable-architecture rule)

export async function getTemplate(templateId) {
  const { data } = await apiClient.get(`/templates/${templateId}`);
  return data;
}

export async function listTenants() {
  const { data } = await apiClient.get("/tenants");
  return data;
}

export async function listTemplates(tenantId) {
  const { data } = await apiClient.get(`/tenants/${tenantId}/templates`);
  return data;
}

export async function listLabels(tenantId) {
  const { data } = await apiClient.get(`/tenants/${tenantId}/labels`);
  return data;
}

export async function createLabel(tenantId, payload) {
  const { data } = await apiClient.post(`/tenants/${tenantId}/labels`, payload);
  return data;
}

export async function listFieldMappings(templateId) {
  const { data } = await apiClient.get(`/templates/${templateId}/field-mappings`);
  return data;
}

export async function createFieldMapping(templateId, payload) {
  const { data } = await apiClient.post(`/templates/${templateId}/field-mappings`, payload);
  return data;
}

export async function deleteFieldMapping(fieldMappingId) {
  await apiClient.delete(`/field-mappings/${fieldMappingId}`);
}

export async function redetectAnchor(fieldMappingId) {
  const { data } = await apiClient.post(`/field-mappings/${fieldMappingId}/detect-anchor`);
  return data;
}

export function pageImageUrl(templateId, pageNumber) {
  return `${apiClient.defaults.baseURL}/templates/${templateId}/pages/${pageNumber}`;
}
