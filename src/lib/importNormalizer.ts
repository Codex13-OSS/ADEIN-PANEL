import { ImportBatch, ImportedRecord, ImportWarning, NormalizedImportPayload, RawImportRow } from '../types/importer';

const KNOWN_HEADERS = [
  'Cliente', 'Teléfono 1', 'Teléfono 2', 'Teléfono original', 'Predio', 'LT', 'Lote', 'MZ', 'Manzana', 'Num',
  'Costo lote', 'Valor letra', 'Última letra pagada', 'Mes en curso', 'Intereses', 'Dirección', 'Observaciones',
  'Vendedor', 'Responsable seguimiento', 'Fecha de pago', 'Fecha de contrato', 'Estatus', 'Próximo seguimiento', 'Notas seguimiento',
] as const;

const toNumberOrNull = (value: string) => {
  const normalized = value.replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIsoDateOrEmpty = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const splitLine = (line: string, delimiter: ',' | '\t') => line.split(delimiter).map((cell) => cell.trim());

export const parseRawRows = (input: string): RawImportRow[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter: ',' | '\t' = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitLine(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    return headers.reduce<RawImportRow>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
};

const normalizeRow = (row: RawImportRow): NormalizedImportPayload => ({
  clientName: row['Cliente'] ?? '',
  primaryPhone: row['Teléfono 1'] ?? '',
  secondaryPhone: row['Teléfono 2'] ?? '',
  originalPhone: row['Teléfono original'] ?? '',
  propertyName: row['Predio'] ?? '',
  lot: row['LT'] ?? '',
  block: row['MZ'] ?? '',
  lotNumber: row['Lote'] || row['Num'] || '',
  lotCost: toNumberOrNull(row['Costo lote'] ?? ''),
  installmentValue: toNumberOrNull(row['Valor letra'] ?? ''),
  lastPaidInstallment: toNumberOrNull(row['Última letra pagada'] ?? ''),
  currentMonth: row['Mes en curso'] ?? '',
  interests: toNumberOrNull(row['Intereses'] ?? ''),
  address: row['Dirección'] ?? '',
  observations: row['Observaciones'] ?? '',
  seller: row['Vendedor'] ?? '',
  followupOwner: row['Responsable seguimiento'] ?? '',
  paymentDate: toIsoDateOrEmpty(row['Fecha de pago'] ?? ''),
  contractDate: toIsoDateOrEmpty(row['Fecha de contrato'] ?? ''),
  status: row['Estatus'] ?? '',
  nextFollowupDate: toIsoDateOrEmpty(row['Próximo seguimiento'] ?? ''),
  followupNotes: row['Notas seguimiento'] ?? '',
});

const collectWarnings = (raw: RawImportRow, normalized: NormalizedImportPayload, duplicateCandidate: boolean): ImportWarning[] => {
  const warnings: ImportWarning[] = [];
  if (!normalized.clientName) warnings.push({ code: 'missing_client', message: 'Falta el nombre del cliente.' });
  if (!normalized.primaryPhone && !normalized.secondaryPhone && !normalized.originalPhone) warnings.push({ code: 'missing_phone', message: 'No hay teléfono disponible.' });
  if ((raw['Fecha de pago'] ?? '').trim() && !normalized.paymentDate) warnings.push({ code: 'invalid_payment_date', message: 'Fecha de pago inválida.' });
  if ((raw['Fecha de contrato'] ?? '').trim() && !normalized.contractDate) warnings.push({ code: 'invalid_contract_date', message: 'Fecha de contrato inválida.' });
  if ((raw['Próximo seguimiento'] ?? '').trim() && !normalized.nextFollowupDate) warnings.push({ code: 'invalid_next_followup_date', message: 'Próximo seguimiento inválido.' });
  if (duplicateCandidate) warnings.push({ code: 'possible_duplicate', message: 'Posible duplicado detectado en el lote.' });
  return warnings;
};

export const buildImportBatch = (input: string, source: ImportBatch['source']): ImportBatch => {
  const rawRows = parseRawRows(input);
  const seen = new Set<string>();

  const records: ImportedRecord[] = rawRows.map((raw, index) => {
    const normalized = normalizeRow(raw);
    const duplicateKey = `${normalized.clientName.toLowerCase()}|${(normalized.primaryPhone || normalized.originalPhone).replace(/\D/g, '')}`;
    const duplicateCandidate = duplicateKey !== '|' && seen.has(duplicateKey);
    seen.add(duplicateKey);

    const warnings = collectWarnings(raw, normalized, duplicateCandidate);

    return {
      id: `${Date.now()}-${index + 1}`,
      raw_payload: KNOWN_HEADERS.reduce<RawImportRow>((acc, header) => {
        acc[header] = raw[header] ?? '';
        return acc;
      }, {}),
      normalized_payload: normalized,
      warnings,
      review_required: warnings.length > 0,
      duplicate_candidate: duplicateCandidate,
    };
  });

  return {
    id: `batch-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source,
    totalRows: records.length,
    records,
  };
};
