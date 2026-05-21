export type MigrationCandidateAction = 'create_candidate' | 'review_required' | 'conflict';
export type MigrationCandidateConfidence = 'high' | 'medium' | 'low';

export type MigrationPreviewCandidateBase = {
  id: string;
  source_row_id: string;
  source_batch_id: string;
  action: MigrationCandidateAction;
  confidence: MigrationCandidateConfidence;
  raw_reference: string;
  normalized_reference: string;
  warnings: string[];
};

export type ClientCandidate = MigrationPreviewCandidateBase & {
  name: string;
  phone_primary: string;
  phone_secondary?: string;
  address_raw?: string;
  seller_name?: string;
  responsible_seller_name?: string;
};

export type PropertyCandidate = MigrationPreviewCandidateBase & { name: string };

export type LotCandidate = MigrationPreviewCandidateBase & {
  property_name: string;
  lot_number: string;
  block?: string;
  internal_number?: string;
  status?: string;
};

export type ContractCandidate = MigrationPreviewCandidateBase & {
  client_name: string;
  property_name: string;
  lot_number: string;
  total_price: number | null;
  contract_date?: string;
  status?: string;
};

export type PaymentScheduleCandidate = MigrationPreviewCandidateBase & {
  amount: number | null;
  due_date?: string;
  due_day?: string;
  current_month_snapshot?: string;
  interest_snapshot?: number | null;
  last_paid_installment_snapshot?: number | null;
};

export type MigrationPreviewConflict = {
  id: string;
  code: string;
  message: string;
  source_batch_id?: string;
  source_row_ids: string[];
};

export type MigrationPreviewWarning = {
  id: string;
  code: string;
  message: string;
  source_batch_id: string;
  source_row_id: string;
};

export type MigrationPreviewSummary = {
  approved_batches_detected: number;
  clients: number;
  properties: number;
  lots: number;
  contracts: number;
  payment_schedule: number;
  warnings: number;
  conflicts: number;
};

export type MigrationPreview = {
  id: string;
  source_batch_id: string;
  created_at: string;
  clients: ClientCandidate[];
  properties: PropertyCandidate[];
  lots: LotCandidate[];
  contracts: ContractCandidate[];
  payment_schedule: PaymentScheduleCandidate[];
  warnings: MigrationPreviewWarning[];
  conflicts: MigrationPreviewConflict[];
  summary: MigrationPreviewSummary;
};

export type MigrationPreviewSelfCheckItem = {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  message: string;
};

export type MigrationPreviewSelfCheckResult = {
  ok: boolean;
  started_at: string;
  finished_at: string;
  checks: MigrationPreviewSelfCheckItem[];
  summary: string;
};
