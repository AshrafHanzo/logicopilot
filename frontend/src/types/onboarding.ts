export interface Mark {
  id: string;
  document_id: string;
  label_name: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  detected_anchor: string | null;
  example_value: string | null;
  anchor_variations: string[] | null;
  semantic_description: string | null;
  value_format_hint: string | null;
  extraction_prompt: string | null;
  correction_prompt: string | null;
  tenant_format_prompt: string | null;
  verify_with_other_document: boolean;
}

export interface TemplateDocument {
  id: string;
  group_id: string;
  name: string;
  doc_type: string;
  order_index: number;
  page_count: number;
  is_uploaded: boolean;
  marks: Mark[];
}

export interface CrossDocLink {
  id: string;
  group_id: string;
  source_mark_id: string;
  target_mark_id: string;
  condition: string;
}

export interface TemplateGroup {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
}

export interface TemplateGroupDetail extends TemplateGroup {
  documents: TemplateDocument[];
  cross_doc_links: CrossDocLink[];
}

export interface DemoFieldResult {
  mark_id: string;
  label_name: string;
  extracted_value: string | null;
  matched_anchor: string | null;
}

export interface DemoResult {
  document_id: string;
  results: DemoFieldResult[];
}

export interface DocumentDeclaration {
  name: string;
  doc_type: string;
}

export const MARK_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
};

export const DATA_TYPES = ["String", "Number", "Date", "Currency"] as const;
export const DOC_TYPES = ["BL", "Invoice", "PackingList", "Custom"] as const;
