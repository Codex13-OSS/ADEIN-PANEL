export const IMPORT_STORAGE_KEY = 'adein.imports.v1';

export type ImportWarningCode =
  | 'missing_client'
  | 'missing_phone'
  | 'invalid_payment_date'
  | 'invalid_contract_date'
  | 'invalid_next_followup_date'
  | 'possible_duplicate';

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

export type ImportedRecord = {
  id: string;
  raw_payload: RawImportRow;
  normalized_payload: NormalizedImportPayload;
  warnings: ImportWarning[];
  review_required: boolean;
  duplicate_candidate: boolean;
};

export type ImportBatch = {
  id: string;
  createdAt: string;
  source: 'manual_csv_tsv' | 'demo_sample';
  totalRows: number;
  records: ImportedRecord[];
};
