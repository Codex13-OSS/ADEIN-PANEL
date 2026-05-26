import * as XLSX from 'xlsx';
import { HistoricalSalesStore } from '../types/historicalSales';

const normalize = (v: unknown) => String(v ?? '').trim();
const low = (v: unknown) => normalize(v).toLowerCase();
const PHONE_MASK = '***-***-****';

const detectHeader = (headers: string[], includes: string[]) => headers.find((h) => includes.some((i) => low(h).includes(i)));
const RESERVED_WORDS = ['javier', 'admin', 'comision', 'comisión', 'interno', 'reservado', 'apartado'];
const PREFERRED_SHEETS = ['base limpia', 'clientes actuales', 'lotes libres', 'prospectos campaña', 'seguimiento vendedores', 'dashboard', 'catálogos'];

const hasPhone = (v: unknown) => String(v ?? '').replace(/\D/g, '').length >= 8;
const isFree = (s: string) => s.includes('libre');
const isReserved = (s: string) => RESERVED_WORDS.some((w) => s.includes(w));

const topBy = (records: Array<Record<string, unknown>>, key?: string) => {
  if (!key) return [];
  const map = new Map<string, number>();
  records.forEach((row) => {
    const value = normalize(row[key]);
    if (!value) return;
    map.set(value, (map.get(value) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
};

export const parseHistoricalSalesExcelFile = async (file: File): Promise<HistoricalSalesStore> => {
  const warnings: string[] = [];
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const workbookSheets = workbook.SheetNames ?? [];

  if (!workbookSheets.length) {
    throw new Error('El Excel no contiene hojas legibles.');
  }

  const preferred = workbookSheets.find((sheet) => PREFERRED_SHEETS.includes(low(sheet)));
  const selectedSheet = preferred ?? workbookSheets
    .map((name) => ({ name, size: XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false }).length }))
    .sort((a, b) => b.size - a.size)[0]?.name ?? workbookSheets[0];

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheet], { defval: '', raw: false }) as Array<Record<string, unknown>>;
  const records = rawRows.filter((row) => Object.values(row).some((v) => normalize(v) !== ''));
  const headers = Object.keys(records[0] ?? {}).map((h) => normalize(h)).filter(Boolean);

  const clientKey = detectHeader(headers, ['cliente', 'clientes', 'nombre', 'nombre cliente']);
  const phoneKey = detectHeader(headers, ['telefono', 'teléfono', 'numero telefonico', 'número telefónico', 'tel', 'celular']);
  const propertyKey = detectHeader(headers, ['predio', 'desarrollo', 'propiedad']);
  const sellerKey = detectHeader(headers, ['vendedor', 'asesor', 'responsable']);
  const statusKey = detectHeader(headers, ['estatus', 'status', 'estado', 'situacion', 'situación']);

  const currentClients = records.filter((r) => {
    if (!clientKey) return false;
    const client = normalize(r[clientKey]);
    const status = statusKey ? low(r[statusKey]) : '';
    return !!client && !isFree(status) && !isReserved(status);
  }).length;

  const clientsWithPhone = records.filter((r) => phoneKey && hasPhone(r[phoneKey])).length;
  const freeLots = records.filter((r) => statusKey && isFree(low(r[statusKey]))).length;
  const reservedOrInternalLots = records.filter((r) => statusKey && isReserved(low(r[statusKey]))).length;
  const soldWithoutPhone = records.filter((r) => {
    if (!statusKey || !phoneKey) return false;
    const status = low(r[statusKey]);
    return !isFree(status) && !isReserved(status) && !hasPhone(r[phoneKey]);
  }).length;

  const topProperties = topBy(records, propertyKey);
  const topSellers = topBy(records, sellerKey);
  const uniqueProperties = propertyKey ? new Set(records.map((r) => normalize(r[propertyKey])).filter(Boolean)) : new Set<string>();

  const previewRows = records.slice(0, 8).map((row) => {
    const next: Record<string, string | number | null> = {};
    Object.entries(row).forEach(([k, v]) => {
      next[k] = normalize(v) || null;
    });
    if (phoneKey && next[phoneKey]) next[phoneKey] = PHONE_MASK;
    return next;
  });

  if (!preferred) warnings.push('No se encontró “Base limpia”; se usó la hoja con más filas útiles.');

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceFileName: file.name,
    workbookSheets,
    selectedSheet,
    summary: {
      totalRows: records.length,
      currentClients,
      clientsWithPhone,
      freeLots,
      reservedOrInternalLots,
      soldWithoutPhone,
      topProperties,
      topSellers,
      totalProperties: uniqueProperties.size,
      soldLots: currentClients,
      reservedLots: reservedOrInternalLots,
      availableLots: freeLots,
      sourceQuality: 'xlsx_parsed',
      parsedSheetName: selectedSheet,
    },
    columnsDetected: headers,
    warnings,
    previewRows,
  };
};
