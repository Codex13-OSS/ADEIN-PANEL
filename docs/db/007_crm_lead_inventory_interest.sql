-- ADEIN CRM v007 - Relación real prospecto → propiedad → lote
-- Aditiva y compatible con leads históricos.
-- Ejecutar sólo mediante el flujo local controlado de migraciones.

ALTER TABLE adein_leads
  ADD COLUMN IF NOT EXISTS inventory_property_id BIGINT UNSIGNED NULL,
  ADD COLUMN IF NOT EXISTS inventory_lot_id BIGINT UNSIGNED NULL,
  ADD KEY IF NOT EXISTS idx_adein_leads_inventory_property_id (inventory_property_id),
  ADD KEY IF NOT EXISTS idx_adein_leads_inventory_lot_id (inventory_lot_id);

ALTER TABLE adein_leads
  ADD CONSTRAINT fk_adein_leads_inventory_property
    FOREIGN KEY (inventory_property_id) REFERENCES properties(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT fk_adein_leads_inventory_lot
    FOREIGN KEY (inventory_lot_id) REFERENCES lots(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
