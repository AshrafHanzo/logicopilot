import { apiClient } from "./client";
import type { Job, JobDetail, JobFieldValue } from "../types/jobs";

export interface AvailableGroup {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
}

export async function listAvailableGroups(): Promise<AvailableGroup[]> {
  const { data } = await apiClient.get<AvailableGroup[]>("/available-groups");
  return data;
}

export async function listJobs(): Promise<Job[]> {
  const { data } = await apiClient.get<Job[]>("/jobs");
  return data;
}

export async function createJob(payload: { group_id: string; reference: string }): Promise<Job> {
  const { data } = await apiClient.post<Job>("/jobs", payload);
  return data;
}

export async function getJob(jobId: string): Promise<JobDetail> {
  const { data } = await apiClient.get<JobDetail>(`/jobs/${jobId}`);
  return data;
}

export async function uploadJobDocument(
  jobId: string,
  templateDocumentId: string,
  file: File,
): Promise<JobDetail> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<JobDetail>(
    `/jobs/${jobId}/documents/${templateDocumentId}/upload`,
    form,
  );
  return data;
}

export async function extractJob(jobId: string): Promise<JobDetail> {
  const { data } = await apiClient.post<JobDetail>(`/jobs/${jobId}/extract`);
  return data;
}

export async function completeJob(jobId: string): Promise<JobDetail> {
  const { data } = await apiClient.post<JobDetail>(`/jobs/${jobId}/complete`);
  return data;
}

export async function setVerificationDecision(
  jobId: string,
  linkId: string,
  accept: boolean,
): Promise<JobDetail> {
  const { data } = await apiClient.post<JobDetail>(`/jobs/${jobId}/verification-decision`, {
    link_id: linkId,
    accept,
  });
  return data;
}

export async function correctFieldValue(valueId: string, correctedValue: string): Promise<JobFieldValue> {
  const { data } = await apiClient.patch<JobFieldValue>(`/job-field-values/${valueId}`, {
    corrected_value: correctedValue,
  });
  return data;
}
