import { HistoricalSalesStore } from '../types/historicalSales';

const normalize = (v: unknown) => String(v ?? '').trim();
const low = (v: unknown) => normalize(v).toLowerCase();
const PHONE_MASK = '***-***-****';

const detect = (headers: string[], includes: string[]) => headers.find((h) => includes.some((i) => low(h).includes(i)));

export const parseHistoricalSalesExcelFile = async (file: File): Promise<HistoricalSalesStore> => {
  const warnings: string[] = [];
  const text = await file.text();
  const rows = text.split(/\r?\n/).map((line) => line.split('\t'));
  if (rows.length < 2) warnings.push('No se detectaron suficientes filas; usa un Excel exportado como texto tabulado para esta beta.');

  const headers = (rows[0] ?? []).map((h) => normalize(h));
  const data = rows.slice(1).filter((r) => r.some((c) => normalize(c) !== ''));
  const records = data.map((row) => Object.fromEntries(headers.map((h, i) => [h, normalize(row[i]) || null])));

  const clientKey = detect(headers, ['cliente']);
  const phoneKey = detect(headers, ['telefono', 'teléfono', 'numero telefonico', 'número telefónico']);
  const propertyKey = detect(headers, ['predio']);
  const sellerKey = detect(headers, ['vendedor']);
  const statusKey = detect(headers, ['estatus', 'status', 'estado']);

  const topBy = (key?: string) => {
    if (!key) return [];
    const map = new Map<string, number>();
    for (const row of records) {
      const name = normalize(row[key]);
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
  };

  const hasPhone = (v: unknown) => String(v ?? '').replace(/\D/g, '').length >= 8;
  const isReserved = (s: string) => ['javier', 'admin', 'comision', 'interno', 'reservado'].some((t) => s.includes(t));

  const currentClients = records.filter((r) => clientKey && normalize(r[clientKey])).length;
  const clientsWithPhone = records.filter((r) => phoneKey && hasPhone(r[phoneKey])).length;
  const freeLots = records.filter((r) => statusKey && low(r[statusKey]).includes('libre')).length;
  const reservedOrInternalLots = records.filter((r) => statusKey && isReserved(low(r[statusKey]))).length;
  const soldWithoutPhone = records.filter((r) => statusKey && !low(r[statusKey]).includes('libre') && phoneKey && !hasPhone(r[phoneKey])).length;

  const previewRows = records.slice(0, 5).map((row) => {
    const next = { ...row };
    if (phoneKey && next[phoneKey]) next[phoneKey] = PHONE_MASK;
    return next;
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceFileName: file.name,
    workbookSheets: ['Sheet1 (preview local)'],
    selectedSheet: 'Sheet1 (preview local)',
    summary: {
      totalRows: records.length,
      currentClients,
      clientsWithPhone,
      freeLots,
      reservedOrInternalLots,
      soldWithoutPhone,
      topProperties: topBy(propertyKey),
      topSellers: topBy(sellerKey),
    },
    columnsDetected: headers,
    warnings,
    previewRows,
  };
};
