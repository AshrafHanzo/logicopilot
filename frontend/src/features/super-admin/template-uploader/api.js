import apiClient from "../../../api/client";

// Backend contract: backend/app/modules/super_admin/template_uploader/schemas.py + routes.py

export async function listTenants() {
  const { data } = await apiClient.get("/tenants");
  return data;
}

export async function listTemplates(tenantId) {
  const { data } = await apiClient.get(`/tenants/${tenantId}/templates`);
  return data;
}

export async function uploadTemplate(tenantId, { name, documentType, file }) {
  const form = new FormData();
  form.append("name", name);
  form.append("document_type", documentType);
  form.append("file", file);
  const { data } = await apiClient.post(`/tenants/${tenantId}/templates`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export function pageImageUrl(templateId, pageNumber) {
  return `${apiClient.defaults.baseURL}/templates/${templateId}/pages/${pageNumber}`;
}
