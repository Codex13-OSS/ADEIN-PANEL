-- ADEIN CRM v023 - Initial schema (versioned only)
-- MariaDB 10.6 compatible
-- IMPORTANT: This file is not executed automatically by the application.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS crm_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(60) NOT NULL DEFAULT 'operator',
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_crm_users_email (email),
  KEY idx_crm_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sellers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sellers_status (status),
  KEY idx_sellers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'lead',
  source VARCHAR(80) NULL,
  assigned_seller_id BIGINT UNSIGNED NULL,
  raw_payload_json LONGTEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_phone (phone),
  KEY idx_clients_assigned_seller_id (assigned_seller_id),
  CONSTRAINT chk_clients_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json)),
  CONSTRAINT fk_clients_assigned_seller FOREIGN KEY (assigned_seller_id) REFERENCES sellers(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  location VARCHAR(220) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  raw_payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_properties_status (status),
  CONSTRAINT chk_properties_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  lot_code VARCHAR(100) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'available',
  total_price DECIMAL(14,2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MXN',
  raw_payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lots_property_lot_code (property_id, lot_code),
  KEY idx_lots_property_lot_code (property_id, lot_code),
  CONSTRAINT chk_lots_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json)),
  CONSTRAINT fk_lots_property FOREIGN KEY (property_id) REFERENCES properties(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contracts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  lot_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NULL,
  contract_code VARCHAR(120) NOT NULL,
  contract_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  signed_at DATETIME NULL,
  total_amount DECIMAL(14,2) NULL,
  down_payment DECIMAL(14,2) NULL,
  balance_amount DECIMAL(14,2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'MXN',
  source_doc_id VARCHAR(160) NULL,
  lia_meta_path VARCHAR(255) NULL,
  raw_payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contracts_contract_code (contract_code),
  KEY idx_contracts_client_id (client_id),
  KEY idx_contracts_lot_id (lot_id),
  KEY idx_contracts_seller_id (seller_id),
  CONSTRAINT chk_contracts_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json)),
  CONSTRAINT fk_contracts_client FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_lot FOREIGN KEY (lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contracts_seller FOREIGN KEY (seller_id) REFERENCES sellers(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_schedule (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id BIGINT UNSIGNED NOT NULL,
  installment_number INT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  expected_amount DECIMAL(14,2) NOT NULL,
  paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  notes TEXT NULL,
  raw_payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_schedule_contract_installment (contract_id, installment_number),
  KEY idx_payment_schedule_contract_due_date (contract_id, due_date),
  CONSTRAINT chk_payment_schedule_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json)),
  CONSTRAINT fk_payment_schedule_contract FOREIGN KEY (contract_id) REFERENCES contracts(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_followups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NULL,
  followup_type VARCHAR(60) NOT NULL DEFAULT 'call',
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  scheduled_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  next_action VARCHAR(255) NULL,
  message_suggestion TEXT NULL,
  raw_payload_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_crm_followups_client_scheduled_at (client_id, scheduled_at),
  KEY idx_crm_followups_seller_id (seller_id),
  CONSTRAINT chk_crm_followups_raw_payload_json CHECK (raw_payload_json IS NULL OR JSON_VALID(raw_payload_json)),
  CONSTRAINT fk_crm_followups_client FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_crm_followups_seller FOREIGN KEY (seller_id) REFERENCES sellers(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_type VARCHAR(60) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'uploaded',
  summary_json LONGTEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_import_batches_status (status),
  KEY idx_import_batches_created_by_user_id (created_by_user_id),
  CONSTRAINT chk_import_batches_summary_json CHECK (summary_json IS NULL OR JSON_VALID(summary_json)),
  CONSTRAINT fk_import_batches_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES crm_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS import_raw_rows (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  row_number INT UNSIGNED NOT NULL,
  raw_payload_json LONGTEXT NOT NULL,
  normalized_payload_json LONGTEXT NULL,
  warnings_json LONGTEXT NULL,
  duplicate_candidate_json LONGTEXT NULL,
  review_required TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_import_raw_rows_batch_id (batch_id),
  KEY idx_import_raw_rows_review_required (review_required),
  CONSTRAINT chk_import_raw_rows_raw_payload_json CHECK (JSON_VALID(raw_payload_json)),
  CONSTRAINT chk_import_raw_rows_normalized_payload_json CHECK (normalized_payload_json IS NULL OR JSON_VALID(normalized_payload_json)),
  CONSTRAINT chk_import_raw_rows_warnings_json CHECK (warnings_json IS NULL OR JSON_VALID(warnings_json)),
  CONSTRAINT chk_import_raw_rows_duplicate_candidate_json CHECK (duplicate_candidate_json IS NULL OR JSON_VALID(duplicate_candidate_json)),
  CONSTRAINT fk_import_raw_rows_batch FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_preview_id VARCHAR(120) NOT NULL,
  source_batch_ids_json LONGTEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  summary_json LONGTEXT NULL,
  entities_json LONGTEXT NULL,
  warnings_json LONGTEXT NULL,
  conflicts_json LONGTEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  approved_by_user_id BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_migration_plans_status (status),
  KEY idx_migration_plans_created_by_user_id (created_by_user_id),
  KEY idx_migration_plans_approved_by_user_id (approved_by_user_id),
  CONSTRAINT chk_migration_plans_source_batch_ids_json CHECK (source_batch_ids_json IS NULL OR JSON_VALID(source_batch_ids_json)),
  CONSTRAINT chk_migration_plans_summary_json CHECK (summary_json IS NULL OR JSON_VALID(summary_json)),
  CONSTRAINT chk_migration_plans_entities_json CHECK (entities_json IS NULL OR JSON_VALID(entities_json)),
  CONSTRAINT chk_migration_plans_warnings_json CHECK (warnings_json IS NULL OR JSON_VALID(warnings_json)),
  CONSTRAINT chk_migration_plans_conflicts_json CHECK (conflicts_json IS NULL OR JSON_VALID(conflicts_json)),
  CONSTRAINT fk_migration_plans_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES crm_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_migration_plans_approved_by_user FOREIGN KEY (approved_by_user_id) REFERENCES crm_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_plan_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  migration_plan_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NULL,
  note TEXT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_migration_plan_events_plan_id (migration_plan_id),
  KEY idx_migration_plan_events_actor_user_id (actor_user_id),
  CONSTRAINT fk_migration_plan_events_plan FOREIGN KEY (migration_plan_id) REFERENCES migration_plans(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_migration_plan_events_actor_user FOREIGN KEY (actor_user_id) REFERENCES crm_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  before_json LONGTEXT NULL,
  after_json LONGTEXT NULL,
  metadata_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_entity_type_entity_id (entity_type, entity_id),
  KEY idx_audit_log_actor_user_id (actor_user_id),
  CONSTRAINT chk_audit_log_before_json CHECK (before_json IS NULL OR JSON_VALID(before_json)),
  CONSTRAINT chk_audit_log_after_json CHECK (after_json IS NULL OR JSON_VALID(after_json)),
  CONSTRAINT chk_audit_log_metadata_json CHECK (metadata_json IS NULL OR JSON_VALID(metadata_json)),
  CONSTRAINT fk_audit_log_actor_user FOREIGN KEY (actor_user_id) REFERENCES crm_users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
