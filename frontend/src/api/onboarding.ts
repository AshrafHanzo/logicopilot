import { apiClient } from "./client";
import type {
  CrossDocLink,
  DemoResult,
  DocumentDeclaration,
  Mark,
  TemplateDocument,
  TemplateGroup,
  TemplateGroupDetail,
} from "../types/onboarding";

// --- Step 1: groups + declared documents ---
export async function createGroup(payload: {
  tenant_id: string;
  name: string;
  documents: DocumentDeclaration[];
}): Promise<TemplateGroupDetail> {
  const { data } = await apiClient.post<TemplateGroupDetail>("/template-groups", payload);
  return data;
}

export async function listGroups(tenantId?: string): Promise<TemplateGroup[]> {
  const { data } = await apiClient.get<TemplateGroup[]>("/template-groups", {
    params: tenantId ? { tenant_id: tenantId } : undefined,
  });
  return data;
}

export async function getGroup(groupId: string): Promise<TemplateGroupDetail> {
  const { data } = await apiClient.get<TemplateGroupDetail>(`/template-groups/${groupId}`);
  return data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/template-groups/${groupId}`);
}

export async function finalizeGroup(groupId: string): Promise<TemplateGroup> {
  const { data } = await apiClient.post<TemplateGroup>(`/template-groups/${groupId}/finalize`);
  return data;
}

// --- Step 2: upload a document file + page previews ---
export async function uploadDocument(documentId: string, file: File): Promise<TemplateDocument> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<TemplateDocument>(
    `/template-documents/${documentId}/upload`,
    form,
  );
  return data;
}

/** Page previews require the auth cookie, which a cross-site <img> won't send.
 * Fetch as an authenticated blob and hand back an object URL (revoke when done). */
export async function fetchPageObjectUrl(documentId: string, page: number): Promise<string> {
  const { data } = await apiClient.get<Blob>(
    `/template-documents/${documentId}/pages/${page}`,
    { responseType: "blob" },
  );
  return URL.createObjectURL(data);
}

// --- Step 3: marks (bounding boxes) ---
export async function createMark(
  documentId: string,
  payload: {
    label_name: string;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    verify_with_other_document?: boolean;
  },
): Promise<Mark> {
  const { data } = await apiClient.post<Mark>(`/template-documents/${documentId}/marks`, payload);
  return data;
}

export async function deleteMark(markId: string): Promise<void> {
  await apiClient.delete(`/marks/${markId}`);
}

export async function correctMark(markId: string, correctionPrompt: string): Promise<Mark> {
  const { data } = await apiClient.patch<Mark>(`/marks/${markId}/correct`, {
    correction_prompt: correctionPrompt,
  });
  return data;
}

// --- Step 3 cross-doc links ---
export async function createCrossDocLink(payload: {
  source_mark_id: string;
  target_mark_id: string;
  condition?: string;
}): Promise<CrossDocLink> {
  const { data } = await apiClient.post<CrossDocLink>("/cross-doc-links", payload);
  return data;
}

export async function deleteCrossDocLink(linkId: string): Promise<void> {
  await apiClient.delete(`/cross-doc-links/${linkId}`);
}

/** Cross-doc verify without re-cropping: link a source field to other documents;
 * the backend copies its profile so the value is found on each doc by meaning. */
export async function linkFieldToDocuments(
  sourceMarkId: string,
  payload: { target_document_ids: string[]; condition?: string },
): Promise<CrossDocLink[]> {
  const { data } = await apiClient.post<CrossDocLink[]>(
    `/field-marks/${sourceMarkId}/link-documents`,
    payload,
  );
  return data;
}

// --- Step 5 demo ---
export async function demoExtract(documentId: string): Promise<DemoResult> {
  const { data } = await apiClient.get<DemoResult>(`/template-documents/${documentId}/demo`);
  return data;
}

/** Run the configured prompts against an UNSEEN uploaded file (no persistence). */
export async function testExtract(documentId: string, file: File): Promise<DemoResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<DemoResult>(
    `/template-documents/${documentId}/test-extract`,
    form,
  );
  return data;
}
