-- ADEIN Commercial Intelligence V1 migration
-- Applied on: adein_crm_dev (local Docker dev only)
-- Base: 004_adein_local_lead_agent_schema.sql
-- NON-DESTRUCTIVE: adds columns, extends enums, new tables only

-- 1) Extend adein_leads with commercial intelligence fields
ALTER TABLE adein_leads
  ADD COLUMN IF NOT EXISTS commercial_stage VARCHAR(60) NOT NULL DEFAULT 'Nuevo' AFTER status,
  ADD COLUMN IF NOT EXISTS contact_state VARCHAR(40) NOT NULL DEFAULT 'Activo' AFTER commercial_stage,
  ADD COLUMN IF NOT EXISTS stage_reason TEXT NOT NULL AFTER summary,
  ADD COLUMN IF NOT EXISTS detected_signals JSON NULL AFTER stage_reason,
  ADD COLUMN IF NOT EXISTS missing_information JSON NULL AFTER detected_signals,
  ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(160) NOT NULL DEFAULT 'Por confirmar' AFTER budget_text,
  ADD COLUMN IF NOT EXISTS suggested_message TEXT NULL AFTER next_action,
  ADD COLUMN IF NOT EXISTS prior_snapshot JSON NULL AFTER suggested_message;

-- 2) Extend analysis events table with full commercial payload
ALTER TABLE adein_lead_analysis_events
  ADD COLUMN IF NOT EXISTS commercial_stage VARCHAR(60) NOT NULL DEFAULT 'Nuevo' AFTER status,
  ADD COLUMN IF NOT EXISTS contact_state VARCHAR(40) NOT NULL DEFAULT 'Activo' AFTER commercial_stage,
  ADD COLUMN IF NOT EXISTS stage_reason TEXT NOT NULL AFTER summary,
  ADD COLUMN IF NOT EXISTS detected_signals JSON NULL AFTER stage_reason,
  ADD COLUMN IF NOT EXISTS missing_information JSON NULL AFTER detected_signals,
  ADD COLUMN IF NOT EXISTS suggested_message TEXT NULL AFTER next_action,
  ADD COLUMN IF NOT EXISTS prior_snapshot JSON NULL AFTER suggested_message,
  ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(160) NOT NULL DEFAULT 'Por confirmar' AFTER missing_information;

-- 3) New table: commercial analysis history (full before/after snapshots)
CREATE TABLE IF NOT EXISTS adein_commercial_analysis_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id BIGINT UNSIGNED NOT NULL,
  source_ref VARCHAR(255) NOT NULL,
  conducted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before_snapshot JSON NULL COMMENT 'lead state before analysis',
  after_snapshot JSON NOT NULL COMMENT 'lead state after analysis',
  changed_fields JSON NULL COMMENT 'array of changed field names',
  raw_model_output JSON NULL COMMENT 'validated model response for debugging',
  PRIMARY KEY (id),
  KEY idx_analysis_history_lead (lead_id),
  KEY idx_analysis_history_conducted (conducted_at),
  CONSTRAINT fk_analysis_history_lead FOREIGN KEY (lead_id) REFERENCES adein_leads (id)
);

-- 4) Modify ENUM for status to support expanded commercial stages
ALTER TABLE adein_leads
  MODIFY COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Nuevo',
  MODIFY COLUMN priority ENUM('Alta', 'Media', 'Baja') NOT NULL;

ALTER TABLE adein_lead_analysis_events
  MODIFY COLUMN status VARCHAR(60) NOT NULL;
