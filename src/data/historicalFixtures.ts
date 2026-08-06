// Fixtures vacíos — listos para datos reales.
// Los arrays vacíos garantizan que todas las métricas y páginas
// que dependen de historicalMetrics arranquen en cero sin datos mock.

export const historicalFixtures = {
  sellers: [] as {
    id: string; name: string; phone: string; source: string; source_file: string;
    review_required: boolean; raw_payload: Record<string, unknown>;
    created_at: string; updated_at: string;
  }[],
  properties: [] as {
    id: string; name: string; source: string; source_file: string;
    review_required: boolean; raw_payload: Record<string, unknown>;
    created_at: string; updated_at: string;
  }[],
  lots: [] as {
    id: string; property_id: string; name: string; status: string;
    source: string; source_file: string; review_required: boolean;
    created_at: string; updated_at: string;
  }[],
  clients: [] as {
    id: string; seller_id: string; name: string; phone: string; status: string;
    source: string; source_file: string; review_required: boolean;
    raw_payload: Record<string, unknown>;
    created_at: string; updated_at: string;
  }[],
  contracts: [] as {
    id: string; client_id: string; lot_id: string; seller_id: string;
    total_amount: number; paid_amount: number;
    source: string; source_file: string; review_required: boolean;
    created_at: string; updated_at: string;
  }[],
  paymentSchedule: [] as {
    id: string; contract_id: string; client_id: string;
    due_date: string; expected_amount: number; status: string;
    source: string; source_file: string; review_required: boolean;
    created_at: string; updated_at: string;
  }[],
  payments: [] as {
    id: string; contract_id: string; client_id: string;
    amount: number; paid_at: string;
    source: string; source_file: string; review_required: boolean;
    created_at: string; updated_at: string;
  }[],
  collectionStatus: [] as {
    id: string; contract_id: string; client_id: string;
    risk_level: string; days_overdue: number; next_payment_date: string;
    seller_id: string;
    source: string; source_file: string; review_required: boolean;
    created_at: string; updated_at: string;
  }[],
};
