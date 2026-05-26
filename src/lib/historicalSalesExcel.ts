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

const normalizeSheetName = (name: string) => low(name).replace(/\s+/g, ' ').trim();
const getHeadersFromRecords = (records: Array<Record<string, unknown>>) => Object.keys(records[0] ?? {}).map((h) => normalize(h)).filter(Boolean);
const detectUsefulKeys = (headers: string[]) => {
  const keys = [
    detectHeader(headers, ['cliente', 'clientes', 'nombre', 'nombre cliente']),
    detectHeader(headers, ['telefono', 'teléfono', 'numero telefonico', 'número telefónico', 'tel', 'celular']),
    detectHeader(headers, ['predio', 'desarrollo', 'propiedad', 'lote']),
    detectHeader(headers, ['vendedor', 'asesor', 'responsable']),
    detectHeader(headers, ['estatus', 'status', 'estado', 'situacion', 'situación']),
  ].filter(Boolean);
  return Array.from(new Set(keys));
};

const isGenericDashboardSheet = (headers: string[]) => {
  if (!headers.length) return true;
  const genericCount = headers.filter((h) => /^_+\d+$/.test(low(h)) || /^\d+$/.test(low(h))).length;
  const hasBaseTitle = headers.some((h) => low(h).includes('base crm adein'));
  return hasBaseTitle || genericCount >= Math.max(2, Math.floor(headers.length * 0.6));
};

const readSheetRecords = (workbook: XLSX.WorkBook, sheetName: string) => {
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false }) as Array<Record<string, unknown>>;
  return rawRows.filter((row) => Object.values(row).some((v) => normalize(v) !== ''));
};

type SheetProfile = {
  sheetName: string;
  normalized: string;
  records: Array<Record<string, unknown>>;
  headers: string[];
  usefulKeys: string[];
  isTabular: boolean;
  isDashboardLike: boolean;
};

const getSheetProfile = (sheetName: string, records: Array<Record<string, unknown>>, headers: string[]): SheetProfile => {
  const usefulKeys = detectUsefulKeys(headers);
  const isDashboardLike = normalizeSheetName(sheetName) === 'dashboard' || isGenericDashboardSheet(headers);
  const isTabular = headers.length > 0 && !isGenericDashboardSheet(headers) && usefulKeys.length > 0;
  return { sheetName, normalized: normalizeSheetName(sheetName), records, headers, usefulKeys, isTabular, isDashboardLike };
};

const readOptionalSheet = (profiles: SheetProfile[], targetName: string) => profiles.find((p) => p.normalized === normalizeSheetName(targetName) && p.isTabular);

const chooseMainSheet = (profiles: SheetProfile[]) => {
  const warnings: string[] = [];
  const skippedSheets: string[] = [];

  const byPriority = PREFERRED_SHEETS
    .map((preferredName) => profiles.find((profile) => profile.normalized === preferredName))
    .filter((profile): profile is SheetProfile => Boolean(profile));

  const preferredTabular = byPriority.find((profile) => profile.isTabular && profile.normalized !== 'dashboard');
  if (preferredTabular) {
    if (profiles.some((p) => p.normalized === 'dashboard' && p.isDashboardLike)) {
      warnings.push('Se omitió la hoja Dashboard como fuente principal porque parece un resumen visual.');
    }
    warnings.push(`Hoja principal: ${preferredTabular.sheetName}.`);
    return { selected: preferredTabular, warnings, skippedSheets, reason: 'preferred_tabular_sheet' };
  }

  byPriority.forEach((profile) => {
    if (!profile.isTabular) skippedSheets.push(profile.sheetName);
  });

  const bestTabular = profiles
    .filter((profile) => profile.isTabular)
    .sort((a, b) => (b.usefulKeys.length * 10 + b.headers.length) - (a.usefulKeys.length * 10 + a.headers.length))[0];

  if (bestTabular) {
    warnings.push(`Hoja principal: ${bestTabular.sheetName}.`);
    return { selected: bestTabular, warnings, skippedSheets, reason: 'best_tabular_sheet' };
  }

  const fallback = profiles[0];
  warnings.push('No se encontró hoja tabular útil; se usó una hoja fallback.');
  return { selected: fallback, warnings, skippedSheets, reason: 'fallback_first_sheet' };
};

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

  const profiles = workbookSheets.map((sheetName) => {
    const records = readSheetRecords(workbook, sheetName);
    const headers = getHeadersFromRecords(records);
    return getSheetProfile(sheetName, records, headers);
  });

  const selectedResult = chooseMainSheet(profiles);
  warnings.push(...selectedResult.warnings);
  const selectedSheet = selectedResult.selected.sheetName;
  const baseRecords = selectedResult.selected.records;
  const headers = selectedResult.selected.headers;

  const clientesSheet = readOptionalSheet(profiles, 'clientes actuales');
  const lotesLibresSheet = readOptionalSheet(profiles, 'lotes libres');
  const sellerSheet = readOptionalSheet(profiles, 'seguimiento vendedores');

  const auxiliarySheetsUsed = [clientesSheet?.sheetName, lotesLibresSheet?.sheetName, sellerSheet?.sheetName].filter((v): v is string => Boolean(v));
  if (auxiliarySheetsUsed.length) warnings.push(`Hojas auxiliares: ${auxiliarySheetsUsed.join(', ')}.`);

  const clientesRecords = clientesSheet?.records ?? [];
  const lotesLibresRecords = lotesLibresSheet?.records ?? [];
  const sellerRecords = sellerSheet?.records?.length ? sellerSheet.records : baseRecords;

  const baseClientKey = detectHeader(headers, ['cliente', 'clientes', 'nombre', 'nombre cliente']);
  const basePhoneKey = detectHeader(headers, ['telefono', 'teléfono', 'numero telefonico', 'número telefónico', 'tel', 'celular']);
  const propertyKey = detectHeader(headers, ['predio', 'desarrollo', 'propiedad']);
  const baseSellerKey = detectHeader(headers, ['vendedor', 'asesor', 'responsable']);
  const statusKey = detectHeader(headers, ['estatus', 'status', 'estado', 'situacion', 'situación']);

  const clientesHeaders = clientesSheet?.headers ?? [];
  const clientesClientKey = detectHeader(clientesHeaders, ['cliente', 'clientes', 'nombre', 'nombre cliente']);
  const clientesPhoneKey = detectHeader(clientesHeaders, ['telefono', 'teléfono', 'numero telefonico', 'número telefónico', 'tel', 'celular']);

  const sellerHeaders = sellerSheet?.headers ?? headers;
  const sellerKey = detectHeader(sellerHeaders, ['vendedor', 'asesor', 'responsable']) ?? baseSellerKey;

  const currentClients = clientesRecords.length
    ? clientesRecords.filter((r) => !clientesClientKey || normalize(r[clientesClientKey])).length
    : baseRecords.filter((r) => {
      if (!baseClientKey) return false;
      const client = normalize(r[baseClientKey]);
      const status = statusKey ? low(r[statusKey]) : '';
      return !!client && !isFree(status) && !isReserved(status);
    }).length;

  const clientsWithPhone = clientesRecords.length
    ? clientesRecords.filter((r) => clientesPhoneKey && hasPhone(r[clientesPhoneKey])).length
    : baseRecords.filter((r) => basePhoneKey && hasPhone(r[basePhoneKey])).length;

  const freeLots = lotesLibresRecords.length
    ? lotesLibresRecords.length
    : baseRecords.filter((r) => statusKey && isFree(low(r[statusKey]))).length;

  const reservedOrInternalLots = baseRecords.filter((r) => statusKey && isReserved(low(r[statusKey]))).length;
  const soldWithoutPhone = baseRecords.filter((r) => {
    if (!statusKey || !basePhoneKey) return false;
    const status = low(r[statusKey]);
    return !isFree(status) && !isReserved(status) && !hasPhone(r[basePhoneKey]);
  }).length;

  const topProperties = topBy(baseRecords, propertyKey);
  const topSellers = topBy(sellerRecords, sellerKey);
  const uniqueProperties = propertyKey ? new Set(baseRecords.map((r) => normalize(r[propertyKey])).filter(Boolean)) : new Set<string>();

  const previewRows = baseRecords.slice(0, 8).map((row) => {
    const next: Record<string, string | number | null> = {};
    Object.entries(row).forEach(([k, v]) => {
      next[k] = normalize(v) || null;
    });
    if (basePhoneKey && next[basePhoneKey]) next[basePhoneKey] = PHONE_MASK;
    return next;
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    sourceFileName: file.name,
    workbookSheets,
    selectedSheet,
    summary: {
      totalRows: baseRecords.length,
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
      auxiliarySheetsUsed,
      skippedSheets: selectedResult.skippedSheets,
      sheetSelectionReason: selectedResult.reason,
    },
    columnsDetected: headers,
    warnings,
    previewRows,
  };
};
