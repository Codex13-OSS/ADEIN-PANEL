-- ADEIN CRM v023 - Post-schema validation checks

SELECT 'tables_missing' AS check_name, GROUP_CONCAT(t.table_name ORDER BY t.table_name) AS details
FROM (
  SELECT 'crm_users' AS table_name UNION ALL
  SELECT 'sellers' UNION ALL
  SELECT 'clients' UNION ALL
  SELECT 'properties' UNION ALL
  SELECT 'lots' UNION ALL
  SELECT 'contracts' UNION ALL
  SELECT 'payment_schedule' UNION ALL
  SELECT 'crm_followups' UNION ALL
  SELECT 'import_batches' UNION ALL
  SELECT 'import_raw_rows' UNION ALL
  SELECT 'migration_plans' UNION ALL
  SELECT 'migration_plan_events' UNION ALL
  SELECT 'audit_log'
) t
LEFT JOIN information_schema.tables ist
  ON ist.table_schema = DATABASE() AND ist.table_name = t.table_name
WHERE ist.table_name IS NULL;

SELECT 'critical_columns_missing' AS check_name, COUNT(*) AS missing_count
FROM (
  SELECT 'clients' AS tbl, 'phone' AS col UNION ALL
  SELECT 'clients', 'assigned_seller_id' UNION ALL
  SELECT 'lots', 'property_id' UNION ALL
  SELECT 'lots', 'lot_code' UNION ALL
  SELECT 'contracts', 'client_id' UNION ALL
  SELECT 'contracts', 'lot_id' UNION ALL
  SELECT 'payment_schedule', 'contract_id' UNION ALL
  SELECT 'payment_schedule', 'due_date' UNION ALL
  SELECT 'crm_followups', 'client_id' UNION ALL
  SELECT 'crm_followups', 'scheduled_at' UNION ALL
  SELECT 'import_raw_rows', 'batch_id' UNION ALL
  SELECT 'migration_plans', 'status' UNION ALL
  SELECT 'audit_log', 'entity_type' UNION ALL
  SELECT 'audit_log', 'entity_id'
) req
LEFT JOIN information_schema.columns c
  ON c.table_schema = DATABASE() AND c.table_name = req.tbl AND c.column_name = req.col
WHERE c.column_name IS NULL;

SELECT 'required_indexes_missing' AS check_name, COUNT(*) AS missing_count
FROM (
  SELECT 'clients' AS tbl, 'idx_clients_phone' AS idx UNION ALL
  SELECT 'clients', 'idx_clients_assigned_seller_id' UNION ALL
  SELECT 'lots', 'idx_lots_property_lot_code' UNION ALL
  SELECT 'contracts', 'idx_contracts_client_id' UNION ALL
  SELECT 'contracts', 'idx_contracts_lot_id' UNION ALL
  SELECT 'payment_schedule', 'idx_payment_schedule_contract_due_date' UNION ALL
  SELECT 'crm_followups', 'idx_crm_followups_client_scheduled_at' UNION ALL
  SELECT 'import_raw_rows', 'idx_import_raw_rows_batch_id' UNION ALL
  SELECT 'migration_plans', 'idx_migration_plans_status' UNION ALL
  SELECT 'audit_log', 'idx_audit_log_entity_type_entity_id'
) req
LEFT JOIN information_schema.statistics s
  ON s.table_schema = DATABASE() AND s.table_name = req.tbl AND s.index_name = req.idx
WHERE s.index_name IS NULL;

SELECT 'business_tables_non_empty_without_seed' AS check_name, tbl, row_count
FROM (
  SELECT 'crm_users' AS tbl, (SELECT COUNT(*) FROM crm_users) AS row_count UNION ALL
  SELECT 'sellers', (SELECT COUNT(*) FROM sellers) UNION ALL
  SELECT 'clients', (SELECT COUNT(*) FROM clients) UNION ALL
  SELECT 'properties', (SELECT COUNT(*) FROM properties) UNION ALL
  SELECT 'lots', (SELECT COUNT(*) FROM lots) UNION ALL
  SELECT 'contracts', (SELECT COUNT(*) FROM contracts) UNION ALL
  SELECT 'payment_schedule', (SELECT COUNT(*) FROM payment_schedule) UNION ALL
  SELECT 'crm_followups', (SELECT COUNT(*) FROM crm_followups) UNION ALL
  SELECT 'import_batches', (SELECT COUNT(*) FROM import_batches) UNION ALL
  SELECT 'import_raw_rows', (SELECT COUNT(*) FROM import_raw_rows) UNION ALL
  SELECT 'migration_plans', (SELECT COUNT(*) FROM migration_plans) UNION ALL
  SELECT 'migration_plan_events', (SELECT COUNT(*) FROM migration_plan_events) UNION ALL
  SELECT 'audit_log', (SELECT COUNT(*) FROM audit_log)
) counts
WHERE row_count > 0;
