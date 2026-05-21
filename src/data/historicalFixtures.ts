export const historicalFixtures = {
  sellers: [
    { id: 'seller-a', name: 'Vendedor A', phone: '55 0000 0000', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { role: 'venta' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'seller-b', name: 'Vendedor B', phone: '55 0000 0000', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { role: 'venta' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  properties: [
    { id: 'property-norte', name: 'Predio Demo Norte', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { zone: 'Norte' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'property-sur', name: 'Predio Demo Sur', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { zone: 'Sur' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  lots: [
    { id: 'lot-01', property_id: 'property-norte', name: 'Lote 01', status: 'vendido', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'lot-02', property_id: 'property-norte', name: 'Lote 02', status: 'reservado', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'lot-03', property_id: 'property-sur', name: 'Lote 03', status: 'libre', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  clients: [
    { id: 'client-uno', seller_id: 'seller-a', name: 'Cliente Demo Uno', phone: '55 0000 0000', status: 'al_corriente', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { score: 'bajo-riesgo' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'client-dos', seller_id: 'seller-b', name: 'Cliente Demo Dos', phone: '55 0000 0000', status: 'atrasado', source: 'fixture-local', source_file: 'fixture-v018', review_required: true, raw_payload: { score: 'alto-riesgo' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'client-tres', seller_id: 'seller-a', name: 'Cliente Demo Tres', phone: '55 0000 0000', status: 'al_corriente', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, raw_payload: { score: 'medio-riesgo' }, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  contracts: [
    { id: 'contract-01', client_id: 'client-uno', lot_id: 'lot-01', seller_id: 'seller-a', total_amount: 420000, paid_amount: 252000, source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'contract-02', client_id: 'client-dos', lot_id: 'lot-02', seller_id: 'seller-b', total_amount: 380000, paid_amount: 95000, source: 'fixture-local', source_file: 'fixture-v018', review_required: true, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  paymentSchedule: [
    { id: 'schedule-01', contract_id: 'contract-01', client_id: 'client-uno', due_date: '2026-05-21', expected_amount: 12000, status: 'pendiente', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'schedule-02', contract_id: 'contract-02', client_id: 'client-dos', due_date: '2026-05-23', expected_amount: 14000, status: 'pendiente', source: 'fixture-local', source_file: 'fixture-v018', review_required: true, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'schedule-03', contract_id: 'contract-02', client_id: 'client-dos', due_date: '2026-06-05', expected_amount: 14000, status: 'pendiente', source: 'fixture-local', source_file: 'fixture-v018', review_required: true, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
  payments: [
    { id: 'payment-01', contract_id: 'contract-01', client_id: 'client-uno', amount: 12000, paid_at: '2026-05-15', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-15T18:00:00.000Z', updated_at: '2026-05-15T18:00:00.000Z' },
    { id: 'payment-02', contract_id: 'contract-02', client_id: 'client-dos', amount: 6000, paid_at: '2026-05-01', source: 'fixture-local', source_file: 'fixture-v018', review_required: true, created_at: '2026-05-01T18:00:00.000Z', updated_at: '2026-05-01T18:00:00.000Z' },
  ],
  collectionStatus: [
    { id: 'collection-01', contract_id: 'contract-01', client_id: 'client-uno', risk_level: 'bajo', days_overdue: 0, next_payment_date: '2026-05-21', seller_id: 'seller-a', source: 'fixture-local', source_file: 'fixture-v018', review_required: false, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
    { id: 'collection-02', contract_id: 'contract-02', client_id: 'client-dos', risk_level: 'alto', days_overdue: 12, next_payment_date: '2026-05-23', seller_id: 'seller-b', source: 'fixture-local', source_file: 'fixture-v018', review_required: true, created_at: '2026-05-21T09:00:00.000Z', updated_at: '2026-05-21T09:00:00.000Z' },
  ],
};
