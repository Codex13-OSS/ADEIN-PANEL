export const IMPORT_STORAGE_KEY = 'adein.imports.v1';

export type ImportWarningCode =
  | 'missing_client'
  | 'missing_phone'
  | 'invalid_payment_date'
  | 'invalid_contract_date'
  | 'invalid_next_followup_date'
  | 'possible_duplicate';

export type ImportBatchStatus =
  | 'staged'
  | 'needs_review'
  | 'reviewed'
  | 'approved_for_migration'
  | 'rejected';

export type ImportRowStatus = 'staged' | 'needs_review' | 'reviewed' | 'rejected';

export type RawImportRow = Record<string, string>;

export type NormalizedImportPayload = {
  clientName: string;
  primaryPhone: string;
  secondaryPhone: string;
  originalPhone: string;
  propertyName: string;
  lot: string;
  block: string;
  lotNumber: string;
  lotCost: number | null;
  installmentValue: number | null;
  lastPaidInstallment: number | null;
  currentMonth: string;
  interests: number | null;
  address: string;
  observations: string;
  seller: string;
  followupOwner: string;
  paymentDate: string;
  contractDate: string;
  status: string;
  nextFollowupDate: string;
  followupNotes: string;
};

export type ImportWarning = {
  code: ImportWarningCode;
  message: string;
};

export type ImportRawRow = {
  id: string;
  source_row: number;
  raw_payload: RawImportRow;
  raw_headers: string[];
  normalized_payload: NormalizedImportPayload;
  warnings: ImportWarning[];
  review_required: boolean;
  duplicate_candidate: boolean;
  status: ImportRowStatus;
};

export type ImportNormalizedRow = ImportRawRow['normalized_payload'];

export type ImportSummary = {
  total_rows: number;
  review_required_rows: number;
  duplicate_candidate_rows: number;
  warning_count: number;
};

export type ImportAuditEventType =
  | 'batch_created'
  | 'batch_reviewed'
  | 'batch_approved_for_migration'
  | 'batch_rejected'
  | 'import_store_cleared';

export type ImportAuditEvent = {
  id: string;
  event_type: ImportAuditEventType;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type ImportBatch = {
  id: string;
  source: 'manual_csv_tsv' | 'demo_sample';
  source_file: string;
  source_sheet: string;
  created_at: string;
  updated_at: string;
  status: ImportBatchStatus;
  rows: ImportRawRow[];
  summary: ImportSummary;
  audit_log: ImportAuditEvent[];
};

export type ImportStore = {
  version: number;
  batches: ImportBatch[];
  audit_log: ImportAuditEvent[];
};
