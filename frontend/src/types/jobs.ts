export interface Job {
  id: string;
  tenant_id: string;
  group_id: string;
  reference: string;
  status: string;
}

export interface JobDocument {
  id: string;
  template_document_id: string;
  name: string;
  doc_type: string;
  is_uploaded: boolean;
  page_count: number;
}

export interface JobFieldValue {
  id: string;
  mark_id: string;
  template_document_id: string;
  document_name: string;
  label_name: string;
  extracted_value: string | null;
  corrected_value: string | null;
  value: string | null;
}

export type VerificationStatus = "match" | "mismatch" | "missing" | "review";

export interface VerificationRow {
  link_id: string;
  field_label: string;
  source_document: string;
  source_value: string | null;
  target_document: string;
  target_value: string | null;
  status: VerificationStatus;
  accepted: boolean;
}

export interface JobDetail {
  id: string;
  tenant_id: string;
  group_id: string;
  group_name: string;
  reference: string;
  status: string;
  documents: JobDocument[];
  field_values: JobFieldValue[];
  verifications: VerificationRow[];
  all_checks_passed: boolean;
}
