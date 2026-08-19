import fs from 'node:fs';
import { validateLocalAdeinDbConfig } from './adein-local-db-config.mjs';

export function loadLocalDbEnv(filePath) {
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    env[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return validateLocalAdeinDbConfig(env);
}

const normalizeNullableText = (value, maxLength, fieldName) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new Error(`${fieldName} excede ${maxLength} caracteres`);
  return normalized;
};

const requireText = (value, maxLength, fieldName) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${fieldName} requerido`);
  if (normalized.length > maxLength) throw new Error(`${fieldName} excede ${maxLength} caracteres`);
  return normalized;
};

const normalizePrice = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) throw new Error('Precio inválido');
  return normalized;
};

export function createMariaDbLeadRepository(connection) {
  return {
    async listLeads() {
      const [rows] = await connection.query(
        `SELECT l.id, l.name, l.phone_original, l.phone_normalized, l.property_interest,
                l.status, l.seller_name, l.updated_at, l.next_action, l.priority,
                l.inventory_property_id, l.inventory_lot_id,
                p.name AS inventory_property_name, lot.lot_code AS inventory_lot_code
         FROM adein_leads l
         LEFT JOIN properties p ON p.id = l.inventory_property_id
         LEFT JOIN lots lot ON lot.id = l.inventory_lot_id
         ORDER BY l.updated_at DESC, l.id DESC`,
      );
      return rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        phone: row.phone_original,
        phoneNormalized: row.phone_normalized,
        property: row.inventory_property_name
          ? `${row.inventory_property_name}${row.inventory_lot_code ? ` · Lote ${row.inventory_lot_code}` : ''}`
          : row.property_interest,
        propertyInterest: row.property_interest,
        inventoryPropertyId: row.inventory_property_id === null ? null : String(row.inventory_property_id),
        inventoryLotId: row.inventory_lot_id === null ? null : String(row.inventory_lot_id),
        inventoryPropertyName: row.inventory_property_name,
        inventoryLotCode: row.inventory_lot_code,
        status: row.status,
        seller: row.seller_name,
        lastContact: new Date(row.updated_at).toISOString(),
        nextAction: row.next_action,
        intentionLevel: row.priority,
        commercialStage: row.commercial_stage || row.status,
        contactState: row.contact_state || 'Activo',
        budget: row.budget_text,
        summary: row.summary,
        stageReason: row.stage_reason,
        detectedSignals: row.detected_signals,
        missingInformation: row.missing_information,
        suggestedMessage: row.suggested_message,
        paymentPreference: row.payment_preference,
      }));
    },
    async listAppointments() {
      const [rows] = await connection.query(
        `SELECT a.id, a.lead_id, l.name, a.appointment_date, a.appointment_time, a.property_interest, a.status
         FROM adein_lead_appointments a JOIN adein_leads l ON l.id = a.lead_id
         ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id ASC`,
      );
      return rows.map((row) => ({ id: String(row.id), leadId: String(row.lead_id), buyerName: row.name, date: String(row.appointment_date).slice(0, 10), time: row.appointment_time ? String(row.appointment_time).slice(0, 5) : '', property: row.property_interest, status: row.status }));
    },
    async getLeadByPhone(phoneNormalized) {
      const [rows] = await connection.query(
        'SELECT * FROM adein_leads WHERE phone_normalized = ?',
        [phoneNormalized]
      );
      return rows.length > 0 ? rows[0] : null;
    },
    async getLeadInventoryInterest(leadId) {
      const [rows] = await connection.query(
        `SELECT l.id, l.property_interest, l.inventory_property_id, l.inventory_lot_id,
                p.name AS property_name, lot.lot_code
         FROM adein_leads l
         LEFT JOIN properties p ON p.id = l.inventory_property_id
         LEFT JOIN lots lot ON lot.id = l.inventory_lot_id
         WHERE l.id = ?`,
        [leadId],
      );
      if (rows.length === 0) throw new Error('Prospecto no encontrado');
      const row = rows[0];
      return {
        leadId: String(row.id),
        propertyInterest: row.property_interest,
        propertyId: row.inventory_property_id === null ? null : String(row.inventory_property_id),
        propertyName: row.property_name,
        lotId: row.inventory_lot_id === null ? null : String(row.inventory_lot_id),
        lotCode: row.lot_code,
      };
    },
    async updateLeadInventoryInterest({ leadId, propertyId, lotId }) {
      const normalizeOptionalId = (value, label) => {
        if (value === null || value === undefined || value === '') return null;
        if (!/^\d+$/.test(String(value))) throw new Error(`${label} inválido`);
        return String(value);
      };
      const safePropertyId = normalizeOptionalId(propertyId, 'Propiedad');
      const safeLotId = normalizeOptionalId(lotId, 'Lote');

      const [leadRows] = await connection.query('SELECT id FROM adein_leads WHERE id = ?', [leadId]);
      if (leadRows.length === 0) throw new Error('Prospecto no encontrado');
      if (safeLotId && !safePropertyId) throw new Error('El lote requiere una propiedad seleccionada');

      if (safePropertyId) {
        const [propertyRows] = await connection.query('SELECT id FROM properties WHERE id = ?', [safePropertyId]);
        if (propertyRows.length === 0) throw new Error('Propiedad no encontrada');
      }

      if (safeLotId) {
        const [lotRows] = await connection.query('SELECT id, property_id FROM lots WHERE id = ?', [safeLotId]);
        if (lotRows.length === 0) throw new Error('Lote no encontrado');
        if (String(lotRows[0].property_id) !== safePropertyId) {
          throw new Error('El lote no pertenece a la propiedad seleccionada');
        }
      }

      await connection.query(
        `UPDATE adein_leads
         SET inventory_property_id = ?, inventory_lot_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [safePropertyId, safeLotId, leadId],
      );
      return this.getLeadInventoryInterest(leadId);
    },
    async getAnalysisHistory(leadId) {
      const [rows] = await connection.query(
        `SELECT id, source_ref, conducted_at, before_snapshot, after_snapshot, changed_fields
         FROM adein_commercial_analysis_history
         WHERE lead_id = ?
         ORDER BY conducted_at DESC
         LIMIT 20`,
        [leadId]
      );
      return rows.map(r => ({
        id: String(r.id),
        sourceRef: r.source_ref,
        conductedAt: r.conducted_at,
        before: r.before_snapshot,
        after: r.after_snapshot,
        changedFields: r.changed_fields,
      }));
    },
    async listProperties() {
      const [rows] = await connection.query(
        `SELECT
           p.id,
           p.name,
           p.location,
           p.status,
           p.created_at,
           p.updated_at,
           COUNT(l.id) AS lot_count,
           SUM(CASE WHEN l.status = 'available' THEN 1 ELSE 0 END) AS available_lot_count,
           MIN(CASE WHEN l.status = 'available' THEN l.total_price ELSE NULL END) AS min_available_price
         FROM properties p
         LEFT JOIN lots l ON l.property_id = p.id
         GROUP BY p.id, p.name, p.location, p.status, p.created_at, p.updated_at
         ORDER BY p.updated_at DESC, p.id DESC`,
      );

      return rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        location: row.location,
        status: row.status,
        lotCount: Number(row.lot_count || 0),
        availableLotCount: Number(row.available_lot_count || 0),
        minAvailablePrice: row.min_available_price === null
          ? null
          : Number(row.min_available_price),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async createProperty({ name, location = null, status = 'active' }) {
      const safeName = requireText(name, 180, 'Nombre');
      const safeLocation = normalizeNullableText(location, 220, 'Ubicación');
      const safeStatus = requireText(status, 40, 'Estado');

      const [result] = await connection.query(
        `INSERT INTO properties (name, location, status)
         VALUES (?, ?, ?)`,
        [safeName, safeLocation, safeStatus],
      );

      return {
        id: String(result.insertId),
        name: safeName,
        location: safeLocation,
        status: safeStatus,
      };
    },

    async updateProperty({ propertyId, name, location, status }) {
      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(requireText(name, 180, 'Nombre'));
      }

      if (location !== undefined) {
        updates.push('location = ?');
        values.push(normalizeNullableText(location, 220, 'Ubicación'));
      }

      if (status !== undefined) {
        updates.push('status = ?');
        values.push(requireText(status, 40, 'Estado'));
      }

      if (updates.length === 0) throw new Error('No hay cambios de propiedad');

      values.push(propertyId);

      const [result] = await connection.query(
        `UPDATE properties
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        values,
      );

      if (result.affectedRows !== 1) throw new Error('Propiedad no encontrada');

      const [rows] = await connection.query(
        `SELECT id, name, location, status, created_at, updated_at
         FROM properties
         WHERE id = ?`,
        [propertyId],
      );

      const row = rows[0];

      return {
        id: String(row.id),
        name: row.name,
        location: row.location,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async listLots(propertyId) {
      const [rows] = await connection.query(
        `SELECT id, property_id, lot_code, status, total_price, currency,
                created_at, updated_at
         FROM lots
         WHERE property_id = ?
         ORDER BY lot_code ASC, id ASC`,
        [propertyId],
      );

      return rows.map((row) => ({
        id: String(row.id),
        propertyId: String(row.property_id),
        lotCode: row.lot_code,
        status: row.status,
        totalPrice: row.total_price === null ? null : Number(row.total_price),
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async createLot({
      propertyId,
      lotCode,
      status = 'available',
      totalPrice = null,
      currency = 'MXN',
    }) {
      const safeLotCode = requireText(lotCode, 100, 'Clave de lote');
      const safeStatus = requireText(status, 40, 'Estado');
      const safeCurrency = requireText(currency, 10, 'Moneda').toUpperCase();
      const safePrice = normalizePrice(totalPrice);

      const [result] = await connection.query(
        `INSERT INTO lots (
           property_id, lot_code, status, total_price, currency
         ) VALUES (?, ?, ?, ?, ?)`,
        [propertyId, safeLotCode, safeStatus, safePrice, safeCurrency],
      );

      return {
        id: String(result.insertId),
        propertyId: String(propertyId),
        lotCode: safeLotCode,
        status: safeStatus,
        totalPrice: safePrice,
        currency: safeCurrency,
      };
    },

    async updateLot({
      propertyId,
      lotId,
      lotCode,
      status,
      totalPrice,
      currency,
    }) {
      const updates = [];
      const values = [];

      if (lotCode !== undefined) {
        updates.push('lot_code = ?');
        values.push(requireText(lotCode, 100, 'Clave de lote'));
      }

      if (status !== undefined) {
        updates.push('status = ?');
        values.push(requireText(status, 40, 'Estado'));
      }

      if (totalPrice !== undefined) {
        updates.push('total_price = ?');
        values.push(normalizePrice(totalPrice));
      }

      if (currency !== undefined) {
        updates.push('currency = ?');
        values.push(requireText(currency, 10, 'Moneda').toUpperCase());
      }

      if (updates.length === 0) throw new Error('No hay cambios de lote');

      values.push(lotId, propertyId);

      const [result] = await connection.query(
        `UPDATE lots
         SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND property_id = ?`,
        values,
      );

      if (result.affectedRows !== 1) throw new Error('Lote no encontrado');

      const [rows] = await connection.query(
        `SELECT id, property_id, lot_code, status, total_price, currency,
                created_at, updated_at
         FROM lots
         WHERE id = ? AND property_id = ?`,
        [lotId, propertyId],
      );

      const row = rows[0];

      return {
        id: String(row.id),
        propertyId: String(row.property_id),
        lotCode: row.lot_code,
        status: row.status,
        totalPrice: row.total_price === null ? null : Number(row.total_price),
        currency: row.currency,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async getPropertyListing(propertyId) {
      const [propertyRows] = await connection.query('SELECT id, name FROM properties WHERE id = ?', [propertyId]);
      if (!propertyRows.length) throw new Error('Propiedad no encontrada');
      const [rows] = await connection.query('SELECT * FROM property_listings WHERE property_id = ?', [propertyId]);
      if (!rows.length) return null;
      const row = rows[0];
      const [features] = await connection.query('SELECT * FROM property_listing_features WHERE listing_id = ? ORDER BY sort_order, id', [row.id]);
      const [images] = await connection.query('SELECT * FROM property_listing_images WHERE listing_id = ? ORDER BY sort_order, id', [row.id]);
      const [operations] = await connection.query('SELECT * FROM property_listing_operations WHERE listing_id = ? ORDER BY sort_order, id', [row.id]);
      return { id: String(row.id), propertyId: String(row.property_id), propertyName: propertyRows[0].name, slug: row.slug, title: row.title, description: row.description, propertyType: row.property_type, operation: row.operation_code, locationKey: row.location_key, location: row.location_label, priceMode: row.price_mode, price: row.price_amount === null ? null : Number(row.price_amount), currency: row.currency, priceDisplay: row.price_display_override, badge: row.commercial_badge, displayOrder: row.display_order, publicationStatus: row.publication_status, publishedAt: row.published_at, unpublishedAt: row.unpublished_at, features: features.map((f) => ({ id: String(f.id), featureKey: f.feature_key, label: f.label, featureValue: f.feature_value, sortOrder: f.sort_order })), images: images.map((i) => ({ id: String(i.id), storageKey: i.storage_key, contentType: i.content_type, sizeBytes: i.size_bytes === null ? null : Number(i.size_bytes), checksum: i.checksum_sha256, altText: i.alt_text, isCover: Boolean(i.is_cover), sortOrder: i.sort_order })), operations: operations.map((o) => ({ id: String(o.id), operationCode: o.operation_code })) };
    },
    async createPropertyListing({ propertyId, title, slug, description = null }) {
      const [properties] = await connection.query('SELECT id FROM properties WHERE id = ?', [propertyId]);
      if (!properties.length) throw new Error('Propiedad no encontrada');
      await connection.query("INSERT INTO property_listings (property_id, slug, title, description, publication_status) VALUES (?, ?, ?, ?, 'draft')", [propertyId, requireText(slug, 180, 'Slug').toLowerCase(), requireText(title, 220, 'Título'), normalizeNullableText(description, 20000, 'Descripción')]);
      return this.getPropertyListing(propertyId);
    },
    async updatePropertyListing({ propertyId, updates }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      const fields = []; const values = [];
      if (updates.title !== undefined) { fields.push('title = ?'); values.push(requireText(updates.title, 220, 'Título')); }
      if (updates.description !== undefined) { fields.push('description = ?'); values.push(normalizeNullableText(updates.description, 20000, 'Descripción')); }
      const mapping = { propertyType: ['property_type', 80], operation: ['operation_code', 40], locationKey: ['location_key', 120], location: ['location_label', 220], priceMode: ['price_mode', 40], priceDisplay: ['price_display_override', 120], currency: ['currency', 10], badge: ['commercial_badge', 100] };
      for (const [input, [column, max]] of Object.entries(mapping)) if (updates[input] !== undefined) { fields.push(`${column} = ?`); values.push(input === 'currency' ? requireText(updates[input], max, 'Moneda').toUpperCase() : normalizeNullableText(updates[input], max, input)); }
      if (updates.price !== undefined) { fields.push('price_amount = ?'); values.push(normalizePrice(updates.price)); }
      if (updates.displayOrder !== undefined) { const value = Number(updates.displayOrder); if (!Number.isInteger(value) || value < 0) throw new Error('Orden inválido'); fields.push('display_order = ?'); values.push(value); }
      if (updates.publicationStatus !== undefined) {
        if (!['draft', 'published', 'unpublished'].includes(updates.publicationStatus)) throw new Error('Estado de publicación inválido');
        fields.push('publication_status = ?'); values.push(updates.publicationStatus);
        if (updates.publicationStatus === 'published') { fields.push('published_at = CURRENT_TIMESTAMP', 'unpublished_at = NULL'); }
        if (updates.publicationStatus === 'unpublished') fields.push('unpublished_at = CURRENT_TIMESTAMP');
      }
      if (!fields.length) throw new Error('No hay cambios de publicación');
      values.push(listing.id); await connection.query(`UPDATE property_listings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
      if (updates.publicationStatus === 'published' || updates.publicationStatus === 'unpublished') await connection.query('INSERT INTO property_listing_operations (listing_id, operation_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP', [listing.id, updates.publicationStatus]);
      return this.getPropertyListing(propertyId);
    },
    async addPropertyListingFeature({ propertyId, input }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      const [[next]] = await connection.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM property_listing_features WHERE listing_id = ?', [listing.id]);
      await connection.query('INSERT INTO property_listing_features (listing_id, feature_key, label, feature_value, sort_order) VALUES (?, ?, ?, ?, ?)', [listing.id, requireText(input.featureKey, 80, 'Clave'), requireText(input.label, 160, 'Característica'), normalizeNullableText(input.featureValue, 220, 'Valor'), next.next_order]);
      return this.getPropertyListing(propertyId);
    },
    async updatePropertyListingFeature({ propertyId, featureId, input }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      const fields = []; const values = [];
      if (input.label !== undefined) { fields.push('label = ?'); values.push(requireText(input.label, 160, 'Característica')); }
      if (input.featureValue !== undefined) { fields.push('feature_value = ?'); values.push(normalizeNullableText(input.featureValue, 220, 'Valor')); }
      if (!fields.length) throw new Error('No hay cambios de característica');
      values.push(featureId, listing.id);
      const [result] = await connection.query(`UPDATE property_listing_features SET ${fields.join(', ')} WHERE id = ? AND listing_id = ?`, values);
      if (result.affectedRows !== 1) throw new Error('Característica no encontrada');
      return this.getPropertyListing(propertyId);
    },
    async reorderPropertyListingFeatures({ propertyId, featureIds }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing || !Array.isArray(featureIds)) throw new Error('Orden inválido');
      const current = listing.features.map((feature) => feature.id);
      if (current.length !== featureIds.length || new Set(featureIds).size !== current.length || featureIds.some((id) => !current.includes(String(id)))) throw new Error('Orden de características inválido');
      await connection.beginTransaction();
      try { for (const [index, featureId] of featureIds.entries()) await connection.query('UPDATE property_listing_features SET sort_order = ? WHERE id = ? AND listing_id = ?', [index, featureId, listing.id]); await connection.commit(); }
      catch (error) { await connection.rollback(); throw error; }
      return this.getPropertyListing(propertyId);
    },
    async deletePropertyListingFeature({ propertyId, featureId }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      await connection.beginTransaction();
      try {
        const [result] = await connection.query('DELETE FROM property_listing_features WHERE id = ? AND listing_id = ?', [featureId, listing.id]);
        if (result.affectedRows !== 1) throw new Error('Característica no encontrada');
        const [remaining] = await connection.query('SELECT id FROM property_listing_features WHERE listing_id = ? ORDER BY sort_order, id', [listing.id]);
        for (const [index, feature] of remaining.entries()) await connection.query('UPDATE property_listing_features SET sort_order = ? WHERE id = ?', [index, feature.id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      return this.getPropertyListing(propertyId);
    },
    async addPropertyListingImage({ propertyId, input }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      const [[next]] = await connection.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM property_listing_images WHERE listing_id = ?', [listing.id]);
      await connection.beginTransaction();
      try {
        if (input.isCover) await connection.query('UPDATE property_listing_images SET is_cover = 0 WHERE listing_id = ?', [listing.id]);
        await connection.query('INSERT INTO property_listing_images (listing_id, storage_key, content_type, size_bytes, checksum_sha256, alt_text, sort_order, is_cover) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [listing.id, requireText(input.storageKey, 500, 'Referencia de imagen'), normalizeNullableText(input.contentType, 100, 'MIME'), input.sizeBytes === undefined ? null : normalizePrice(input.sizeBytes), normalizeNullableText(input.checksum, 64, 'Checksum'), normalizeNullableText(input.altText, 255, 'Texto alternativo'), next.next_order, input.isCover || listing.images.length === 0 ? 1 : 0]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      return this.getPropertyListing(propertyId);
    },
    async setPropertyListingImageCover({ propertyId, imageId }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      await connection.beginTransaction(); try {
        const [found] = await connection.query('SELECT id FROM property_listing_images WHERE id = ? AND listing_id = ?', [imageId, listing.id]); if (!found.length) throw new Error('Imagen no encontrada');
        await connection.query('UPDATE property_listing_images SET is_cover = 0 WHERE listing_id = ?', [listing.id]);
        await connection.query('UPDATE property_listing_images SET is_cover = 1 WHERE id = ?', [imageId]); await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
      return this.getPropertyListing(propertyId);
    },
    async reorderPropertyListingImages({ propertyId, imageIds }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing || !Array.isArray(imageIds)) throw new Error('Orden inválido');
      const current = listing.images.map((image) => image.id); if (current.length !== imageIds.length || new Set(imageIds).size !== current.length || imageIds.some((id) => !current.includes(String(id)))) throw new Error('Orden de imágenes inválido');
      await connection.beginTransaction(); try { for (const [index, imageId] of imageIds.entries()) await connection.query('UPDATE property_listing_images SET sort_order = ? WHERE id = ? AND listing_id = ?', [index, imageId, listing.id]); await connection.commit(); } catch (error) { await connection.rollback(); throw error; }
      return this.getPropertyListing(propertyId);
    },
    async deletePropertyListingImage({ propertyId, imageId }) {
      const listing = await this.getPropertyListing(propertyId); if (!listing) throw new Error('Listing no encontrado');
      const image = listing.images.find((item) => item.id === String(imageId)); if (!image) throw new Error('Imagen no encontrada');
      await connection.beginTransaction(); try { await connection.query('DELETE FROM property_listing_images WHERE id = ? AND listing_id = ?', [imageId, listing.id]); const [remaining] = await connection.query('SELECT id FROM property_listing_images WHERE listing_id = ? ORDER BY sort_order, id', [listing.id]); for (const [index, item] of remaining.entries()) await connection.query('UPDATE property_listing_images SET sort_order = ?, is_cover = ? WHERE id = ?', [index, index === 0 ? 1 : 0, item.id]); await connection.commit(); } catch (error) { await connection.rollback(); throw error; }
      return image;
    },
    async getPublicListingImage(storageKey) {
      const [rows] = await connection.query(`SELECT i.storage_key, i.content_type, i.checksum_sha256 FROM property_listing_images i JOIN property_listings l ON l.id = i.listing_id JOIN properties p ON p.id = l.property_id WHERE i.storage_key = ? AND l.publication_status = 'published' AND p.status = 'active' LIMIT 1`, [storageKey]);
      return rows[0] || null;
    },
    async listPublicListings() {
      const [rows] = await connection.query(
        `SELECT l.id, l.property_id, l.slug, l.title, l.description, l.property_type,
                l.location_key, l.location_label, l.price_mode, l.price_amount, l.currency, l.price_display_override,
                l.commercial_badge, l.operation_code, l.display_order, l.published_at,
                p.name AS property_name,
                COUNT(lot.id) AS lot_total,
                SUM(CASE WHEN lot.status = 'available' THEN 1 ELSE 0 END) AS lot_available,
                MIN(CASE WHEN lot.status = 'available' THEN lot.total_price ELSE NULL END) AS lot_from_price
         FROM property_listings l
         JOIN properties p ON p.id = l.property_id
         LEFT JOIN lots lot ON lot.property_id = p.id
         WHERE l.publication_status = 'published' AND p.status = 'active'
         GROUP BY l.id, p.id
         ORDER BY l.display_order ASC, l.id ASC`,
      );
      const listingIds = rows.map((row) => row.id);
      if (!listingIds.length) return [];
      const placeholders = listingIds.map(() => '?').join(', ');
      const [features] = await connection.query(
        `SELECT listing_id, feature_key, label, feature_value FROM property_listing_features
         WHERE listing_id IN (${placeholders}) ORDER BY sort_order, id`, listingIds,
      );
      const [images] = await connection.query(
        `SELECT id, listing_id, storage_key, alt_text, is_cover, sort_order FROM property_listing_images
         WHERE listing_id IN (${placeholders}) ORDER BY is_cover DESC, sort_order, id`, listingIds,
      );
      return rows.map((row) => ({
        id: String(row.id), propertyId: String(row.property_id), slug: row.slug, title: row.title,
        description: row.description, propertyType: row.property_type, operation: row.operation_code, locationKey: row.location_key, location: row.location_label, priceMode: row.price_mode,
        price: row.price_amount === null ? null : Number(row.price_amount), currency: row.currency, priceDisplay: row.price_display_override, badge: row.commercial_badge, displayOrder: row.display_order,
        publishedAt: row.published_at,
        lotsSummary: { total: Number(row.lot_total), available: Number(row.lot_available || 0), fromPrice: row.lot_from_price === null ? null : Number(row.lot_from_price) },
        features: features.filter((feature) => feature.listing_id === row.id).map((feature) => ({ key: feature.feature_key, label: feature.label, value: feature.feature_value })),
        images: images.filter((image) => image.listing_id === row.id).map((image) => ({ id: String(image.id), url: `/api/public/media/${encodeURIComponent(image.storage_key)}`, storageKey: image.storage_key, altText: image.alt_text, isCover: Boolean(image.is_cover), sortOrder: image.sort_order })),
      }));
    },
    async saveIngestion(record) {
      const { lead, appointment, sourceRef, meta } = record;
      await connection.beginTransaction();
      try {
        // Fetch existing lead for before snapshot
        const [priorRows] = await connection.query(
          'SELECT * FROM adein_leads WHERE phone_normalized = ?',
          [lead.phoneNormalized]
        );
        const priorLead = priorRows.length > 0 ? priorRows[0] : null;

        const commercialStage = meta?.commercialStage || lead.status || 'Nuevo';
        const contactState = meta?.contactState || 'Activo';
        const stageReason = meta?.stageReason || '';
        const detectedSignals = meta?.detectedSignals ? JSON.stringify(meta.detectedSignals) : null;
        const missingInformation = meta?.missingInformation ? JSON.stringify(meta.missingInformation) : null;
        const paymentPreference = meta?.paymentPreference || 'Por confirmar';
        const suggestedMessage = meta?.suggestedMessage || null;
        const nextActionType = meta?.nextActionType || 'SEGUIMIENTO';

        const [leadResult] = await connection.query(
          `INSERT INTO adein_leads (
            phone_normalized, phone_original, name, seller_name, property_interest, budget_text,
            payment_preference, priority, status, commercial_stage, contact_state, summary,
            stage_reason, detected_signals, missing_information,
            next_action, suggested_message, suggested_followup_at, review_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            phone_original = VALUES(phone_original),
            name = VALUES(name),
            seller_name = VALUES(seller_name),
            property_interest = VALUES(property_interest),
            budget_text = VALUES(budget_text),
            payment_preference = VALUES(payment_preference),
            priority = VALUES(priority),
            status = VALUES(status),
            commercial_stage = VALUES(commercial_stage),
            contact_state = VALUES(contact_state),
            summary = VALUES(summary),
            stage_reason = VALUES(stage_reason),
            detected_signals = VALUES(detected_signals),
            missing_information = VALUES(missing_information),
            next_action = VALUES(next_action),
            suggested_message = VALUES(suggested_message),
            suggested_followup_at = VALUES(suggested_followup_at),
            review_status = VALUES(review_status),
            updated_at = CURRENT_TIMESTAMP`,
          [
            lead.phoneNormalized, lead.phoneOriginal, lead.name, lead.seller, lead.property, lead.budget,
            paymentPreference, lead.priority, lead.status, commercialStage, contactState, lead.summary,
            stageReason, detectedSignals, missingInformation,
            lead.nextAction, suggestedMessage, lead.suggestedFollowupAt, lead.reviewStatus,
          ],
        );
        const leadId = Number(leadResult.insertId);
        const action = priorLead ? 'updated' : 'created';

        // Save analysis event
        await connection.query(
          `INSERT INTO adein_lead_analysis_events (
            lead_id, source_ref, priority, status, commercial_stage, contact_state,
            summary, stage_reason, detected_signals, missing_information,
            next_action, suggested_message, suggested_followup_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [leadId, sourceRef, lead.priority, lead.status, commercialStage, contactState,
           lead.summary, stageReason, detectedSignals, missingInformation,
           lead.nextAction, suggestedMessage, lead.suggestedFollowupAt],
        );

        // Save commercial analysis history (before/after snapshots)
        const beforeSnapshot = priorLead ? {
          name: priorLead.name,
          priority: priorLead.priority,
          status: priorLead.status,
          commercialStage: priorLead.commercial_stage || priorLead.status,
          contactState: priorLead.contact_state || 'Activo',
          property: priorLead.property_interest,
          budget: priorLead.budget_text,
          nextAction: priorLead.next_action,
        } : null;

        const afterSnapshot = {
          name: lead.name,
          priority: lead.priority,
          status: lead.status,
          commercialStage,
          contactState,
          property: lead.property,
          budget: lead.budget,
          nextAction: lead.nextAction,
        };

        const changedFields = priorLead
          ? Object.keys(afterSnapshot).filter(k => {
              const b = beforeSnapshot?.[k];
              const a = afterSnapshot[k];
              return JSON.stringify(b) !== JSON.stringify(a);
            })
          : [];

        await connection.query(
          `INSERT INTO adein_commercial_analysis_history (
            lead_id, source_ref, before_snapshot, after_snapshot, changed_fields
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            leadId, sourceRef,
            beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
            JSON.stringify(afterSnapshot),
            changedFields.length > 0 ? JSON.stringify(changedFields) : null,
          ],
        );

        if (appointment) {
          await connection.query(
            `INSERT INTO adein_lead_appointments (
              lead_id, appointment_date, appointment_time, property_interest, status, source_ref
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [leadId, appointment.date, appointment.time || null, appointment.property, appointment.status, sourceRef],
          );
        }

        await connection.query(
          `INSERT INTO adein_processed_files (source_ref, content_hash) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE content_hash = VALUES(content_hash)`,
          [sourceRef, `source-ref:${sourceRef}`],
        );

        await connection.commit();
        return {
          leadId, action, lead,
          before: beforeSnapshot,
          after: afterSnapshot,
          changedFields,
          meta: record.meta || null,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
    async saveAppointment({ leadId, buyerName, date, time }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Fecha de cita inválida');
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
      );
      const today = `${parts.year}-${parts.month}-${parts.day}`;
      if (date < today) throw new Error('No se pueden agendar citas en el pasado');
      if (time && !/^\d{2}:\d{2}$/.test(String(time))) throw new Error('Hora de cita inválida');
      const name = String(buyerName ?? '').trim();
      if (!name) throw new Error('Nombre del comprador requerido');
      await connection.beginTransaction();
      try {
        const [updated] = await connection.query(
          `UPDATE adein_leads SET name = ?, status = 'Cita agendada', next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [name, `Confirmar cita el ${date}${time ? ` a las ${time}` : ''}.`, leadId],
        );
        if (updated.affectedRows !== 1) throw new Error('Prospecto no encontrado');
        await connection.query(
          `INSERT INTO adein_lead_appointments (lead_id, appointment_date, appointment_time, property_interest, status, source_ref)
           SELECT id, ?, ?, property_interest, 'Agendada', 'crm_manual' FROM adein_leads WHERE id = ?`,
          [date, time || null, leadId],
        );
        await connection.commit();
        return { ok: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
    async saveReminder({ leadId, days }) {
      const validDays = new Set([1, 3, 7]);
      if (!validDays.has(Number(days))) throw new Error('Recordatorio no permitido');
      const followupAt = new Date();
      followupAt.setDate(followupAt.getDate() + Number(days));
      const date = followupAt.toISOString().slice(0, 10);
      const [updated] = await connection.query(
        `UPDATE adein_leads SET suggested_followup_at = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [date, `Enviar mensaje de seguimiento el ${date}.`, leadId],
      );
      if (updated.affectedRows !== 1) throw new Error('Prospecto no encontrado');
      return { ok: true, followupAt: date };
    },
    async completeAppointment({ appointmentId }) {
      await connection.beginTransaction();
      try {
        const [rows] = await connection.query('SELECT lead_id FROM adein_lead_appointments WHERE id = ?', [appointmentId]);
        if (rows.length !== 1) throw new Error('Cita no encontrada');
        await connection.query("UPDATE adein_lead_appointments SET status = 'Realizada' WHERE id = ?", [appointmentId]);
        await connection.query("UPDATE adein_leads SET next_action = 'Registrar resultado de la cita.', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rows[0].lead_id]);
        await connection.commit();
        return { ok: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    },
  };
}
