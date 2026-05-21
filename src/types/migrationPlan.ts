import {
  MigrationPreview,
  MigrationPreviewConflict,
  MigrationPreviewWarning,
} from './migrationPreview';

export type MigrationPlanStatus = 'draft' | 'ready_for_review' | 'approved' | 'rejected' | 'archived';

export type MigrationPlanAuditEventType =
  | 'plan_created_from_preview'
  | 'plan_status_changed'
  | 'plans_cleared';

export type MigrationPlanAuditEvent = {
  id: string;
  created_at: string;
  event_type: MigrationPlanAuditEventType;
  message: string;
  metadata?: Record<string, unknown>;
};

export type MigrationPlanEntities = {
  clients: MigrationPreview['clients'];
  properties: MigrationPreview['properties'];
  lots: MigrationPreview['lots'];
  contracts: MigrationPreview['contracts'];
  payment_schedule: MigrationPreview['payment_schedule'];
};

export type MigrationPlanSummary = {
  source_batches_detected: number;
  clients: number;
  properties: number;
  lots: number;
  contracts: number;
  payment_schedule: number;
  warnings: number;
  conflicts: number;
};

export type MigrationPlan = {
  id: string;
  source_preview_id: string;
  source_batch_ids: string[];
  created_at: string;
  updated_at: string;
  status: MigrationPlanStatus;
  entities: MigrationPlanEntities;
  warnings: MigrationPreviewWarning[];
  conflicts: MigrationPreviewConflict[];
  summary: MigrationPlanSummary;
  audit_log: MigrationPlanAuditEvent[];
};

export type MigrationPlanSelfCheckItem = {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  message: string;
};

export type MigrationPlanSelfCheckResult = {
  ok: boolean;
  started_at: string;
  finished_at: string;
  checks: MigrationPlanSelfCheckItem[];
  summary: string;
};
