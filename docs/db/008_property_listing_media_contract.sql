-- ADEIN CRM v008 - Portable public listing media and commercial operation contract
-- MariaDB 10.6 compatible. Additive and idempotent; no DML or destructive statements.
-- storage_key is intentionally a relative key resolved by /api/public/media/.

ALTER TABLE property_listing_images
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) NULL AFTER storage_key,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT UNSIGNED NULL AFTER content_type,
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64) NULL AFTER size_bytes;

ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS operation_code VARCHAR(40) NOT NULL DEFAULT 'venta' AFTER property_type;

CREATE INDEX IF NOT EXISTS idx_property_listings_operation
  ON property_listings (operation_code);

CREATE INDEX IF NOT EXISTS idx_property_listing_images_checksum
  ON property_listing_images (checksum_sha256);

-- One-cover and reorder integrity are enforced by transactional repository methods.
-- A portable MariaDB unique constraint for a nullable generated cover marker is
-- intentionally avoided here so existing legacy image references remain additive.
-- Read order is always sort_order, id; writes normalize sort_order to 0..N-1.
