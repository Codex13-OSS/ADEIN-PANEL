-- ADEIN local lead-agent schema.
-- Scope: local development only. No production tables, no raw conversations.

CREATE TABLE IF NOT EXISTS `adein_leads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone_normalized` VARCHAR(30) NULL,
  `phone_original` VARCHAR(60) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `seller_name` VARCHAR(160) NOT NULL DEFAULT 'Vendedor 1',
  `property_interest` VARCHAR(160) NOT NULL DEFAULT 'Por confirmar',
  `budget_text` VARCHAR(160) NOT NULL DEFAULT 'Por confirmar',
  `priority` ENUM('Alta', 'Media', 'Baja') NOT NULL,
  `status` ENUM('Nuevo', 'Contactado', 'Cita agendada', 'Venta', 'Descartado', 'Revisión manual') NOT NULL,
  `summary` TEXT NOT NULL,
  `next_action` VARCHAR(255) NOT NULL,
  `suggested_followup_at` DATE NOT NULL,
  `review_status` ENUM('pending', 'reviewed') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY uq_adein_leads_phone (`phone_normalized`),
  KEY idx_adein_leads_priority (`priority`),
  KEY idx_adein_leads_status (`status`)
);

CREATE TABLE IF NOT EXISTS `adein_lead_appointments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` BIGINT UNSIGNED NOT NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time` TIME NULL,
  `property_interest` VARCHAR(160) NOT NULL DEFAULT 'Por confirmar',
  `status` VARCHAR(60) NOT NULL,
  `source_ref` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY idx_adein_appointments_lead (`lead_id`),
  CONSTRAINT fk_adein_appointments_lead FOREIGN KEY (`lead_id`) REFERENCES `adein_leads` (`id`)
);

CREATE TABLE IF NOT EXISTS `adein_lead_analysis_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lead_id` BIGINT UNSIGNED NOT NULL,
  `source_ref` VARCHAR(255) NOT NULL,
  `priority` ENUM('Alta', 'Media', 'Baja') NOT NULL,
  `status` VARCHAR(60) NOT NULL,
  `summary` TEXT NOT NULL,
  `next_action` VARCHAR(255) NOT NULL,
  `suggested_followup_at` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY uq_adein_analysis_source_ref (`source_ref`),
  KEY idx_adein_analysis_lead (`lead_id`),
  CONSTRAINT fk_adein_analysis_lead FOREIGN KEY (`lead_id`) REFERENCES `adein_leads` (`id`)
);

CREATE TABLE IF NOT EXISTS `adein_processed_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `source_ref` VARCHAR(255) NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `processed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY uq_adein_processed_files_source_ref (`source_ref`),
  UNIQUE KEY uq_adein_processed_files_hash (`content_hash`)
);
