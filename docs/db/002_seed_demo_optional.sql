-- ADEIN CRM v023 - OPTIONAL demo seed
-- Do not execute in production.

INSERT INTO sellers (name, phone, email, status)
VALUES
  ('Vendedor A', '55 0000 0000', 'vendedor.a.demo@example.com', 'active'),
  ('Vendedor B', '55 0000 0000', 'vendedor.b.demo@example.com', 'active');

INSERT INTO properties (name, location, status)
VALUES
  ('Predio Demo Norte', 'Zona Demo Norte', 'active'),
  ('Predio Demo Sur', 'Zona Demo Sur', 'active');

INSERT INTO lots (property_id, lot_code, status, total_price, currency)
VALUES
  (1, 'Lote 01', 'available', 550000.00, 'MXN'),
  (2, 'Lote 02', 'reserved', 650000.00, 'MXN');

INSERT INTO clients (full_name, phone, email, status, source, assigned_seller_id, notes)
VALUES
  ('Cliente Demo Uno', '55 0000 0000', 'cliente.uno.demo@example.com', 'lead', 'demo_seed', 1, 'Registro ficticio de demostración'),
  ('Cliente Demo Dos', '55 0000 0000', 'cliente.dos.demo@example.com', 'prospect', 'demo_seed', 2, 'Registro ficticio de demostración'),
  ('Cliente Demo Conflicto', '55 0000 0000', 'cliente.conflicto.demo@example.com', 'review', 'demo_seed', 1, 'Registro ficticio para pruebas de conflicto');
