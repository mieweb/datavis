import { AGGREGATE_REGISTRY, AggregateInfo } from 'wcdatavis/src/aggregates.js';
import { Source } from 'wcdatavis/src/source.js';

export interface NormalizedViewData {
  isPlain: boolean;
  isGroup: boolean;
  isPivot: boolean;
  data: unknown[];
  dataByRowId?: Record<string, unknown>;
  rowVals?: unknown[];
  colVals?: unknown[];
  groupFields?: string[];
  pivotFields?: string[];
  groupMetadata?: unknown;
  agg?: unknown;
  totalCol?: Record<string, unknown>[];
  totalRow?: Record<string, unknown>[];
  grandTotal?: Record<string, unknown>;
  totalAggregates?: Record<string, unknown>;
}

export interface AggregateSpecItem {
  fun?: string;
  fn?: string;
  fields?: string[];
  name?: string;
  isHidden?: boolean;
  shouldGraph?: boolean;
  opts?: Record<string, unknown>;
}

export interface AggregateSpecMap {
  group: AggregateSpecItem[];
  pivot: AggregateSpecItem[];
  cell: AggregateSpecItem[];
  all: AggregateSpecItem[];
}

interface LegacyCell {
  value?: unknown;
  orig?: unknown;
}

interface LegacyRowData {
  [field: string]: LegacyCell | unknown;
}

interface LegacyRow {
  rowNum: number;
  rowData: LegacyRowData;
}

interface LegacyOrdMap<T = unknown> {
  get(key: string): T | undefined;
}

interface LegacyAggInfoEntry {
  fun?: string;
  fields?: string[];
  name?: string;
}

interface LegacyAggData {
  info?: {
    group?: LegacyAggInfoEntry[];
    pivot?: LegacyAggInfoEntry[];
    cell?: LegacyAggInfoEntry[];
    all?: LegacyAggInfoEntry[];
  };
  results?: {
    group?: unknown[][];
    pivot?: unknown[][];
    cell?: unknown[][][];
    all?: unknown[];
  };
}

interface LegacyGroupLookupNode {
  numRows?: number;
}

interface LegacyGroupMetadata {
  lookup?: {
    byRowValIndex?: LegacyGroupLookupNode[];
  };
}

interface LegacyViewData {
  isPlain: boolean;
  isGroup: boolean;
  isPivot: boolean;
  data: unknown;
  dataByRowId?: LegacyRowData[] | Record<string, LegacyRowData>;
  rowVals?: unknown[][];
  colVals?: unknown[][];
  groupFields?: string[];
  pivotFields?: string[];
  groupMetadata?: LegacyGroupMetadata;
  agg?: LegacyAggData;
}

interface ColumnLike {
  field: string;
  header?: string;
  typeInfo?: {
    type?: string;
    format?: string;
    internalType?: string;
  };
}

const SUPPORTED_SOURCE_TYPES = new Set([
  'string',
  'number',
  'currency',
  'date',
  'datetime',
  'time',
  'duration',
  'json',
]);

function normalizeSourceType(type: string | undefined): string {
  if (!type) return 'string';
  if (type === 'integer') return 'number';
  if (type === 'boolean') return 'string';
  return SUPPORTED_SOURCE_TYPES.has(type) ? type : 'string';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLegacyCell(value: unknown): value is LegacyCell {
  return isObject(value) && ('value' in value || 'orig' in value);
}

function unwrapCell(value: unknown): unknown {
  if (!isLegacyCell(value)) return value;
  if ('value' in value) return value.value;
  return value.orig;
}

function legacyRowToPlainRow(row: LegacyRow, groupValueOverrides?: Record<string, unknown>): Record<string, unknown> {
  const plainRow: Record<string, unknown> = {
    _rowId: String(row.rowNum),
  };

  for (const [field, value] of Object.entries(row.rowData)) {
    plainRow[field] = unwrapCell(value);
  }

  if (groupValueOverrides) {
    Object.assign(plainRow, groupValueOverrides);
  }

  return plainRow;
}

function rowValueArrayToObject(values: unknown[] | undefined, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((field, index) => [field, values?.[index]]));
}

function pivotValueToDisplay(value: unknown[] | undefined): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length <= 1) return value[0];
  return value.map((item) => String(item ?? '')).join(' / ');
}

function serializeGroupKey(groupValues: Record<string, unknown>, groupFields: string[]): string {
  return groupFields.map((field) => `${field}:${String(groupValues[field] ?? '')}`).join('|||');
}

function buildAggregateKey(info: LegacyAggInfoEntry | undefined): string | null {
  const fn = info?.fun ?? (info as AggregateSpecItem | undefined)?.fn;
  if (!fn) return null;
  const field = info.fields?.[0];
  return field ? `${fn}(${field})` : fn;
}

function buildAggregateRecord(infos: LegacyAggInfoEntry[] | undefined, values: unknown[] | undefined): Record<string, unknown> {
  if (!infos?.length || !values?.length) return {};

  const record: Record<string, unknown> = {};
  infos.forEach((info, index) => {
    const key = buildAggregateKey(info);
    if (!key) return;
    record[key] = values[index];
  });
  return record;
}

function normalizePlainData(raw: LegacyViewData): { rows: Record<string, unknown>[]; dataByRowId: Record<string, unknown> } {
  const rows = Array.isArray(raw.data) ? (raw.data as LegacyRow[]).map((row) => legacyRowToPlainRow(row)) : [];
  const dataByRowId = Object.fromEntries(rows.map((row) => [String(row._rowId), row]));
  return { rows, dataByRowId };
}

function normalizeGroupData(raw: LegacyViewData): Pick<NormalizedViewData, 'data' | 'dataByRowId' | 'groupFields' | 'groupMetadata'> {
  const groupFields = raw.groupFields ?? [];
  const groupedRows = Array.isArray(raw.data) ? (raw.data as LegacyRow[][]) : [];
  const rowVals = raw.rowVals ?? [];
  const agg = raw.agg;
  const byRowValIndex = raw.groupMetadata?.lookup?.byRowValIndex ?? [];

  const flattenedRows: Record<string, unknown>[] = [];
  const dataByRowId: Record<string, unknown> = {};
  const groupMetadata: Record<string, unknown> = {};

  groupedRows.forEach((rows, rowIndex) => {
    const groupValues = rowValueArrayToObject(rowVals[rowIndex], groupFields);
    const groupKey = serializeGroupKey(groupValues, groupFields);

    groupMetadata[groupKey] = {
      groupValues,
      count: byRowValIndex[rowIndex]?.numRows ?? rows.length,
      level: 0,
      aggregates: buildAggregateRecord(agg?.info?.group, agg?.results?.group?.map((values) => values[rowIndex])),
    };

    rows.forEach((row) => {
      const plainRow = legacyRowToPlainRow(row, groupValues);
      flattenedRows.push(plainRow);
      dataByRowId[String(plainRow._rowId)] = plainRow;
    });
  });

  return {
    data: flattenedRows,
    dataByRowId,
    groupFields,
    groupMetadata,
  };
}

function normalizePivotData(raw: LegacyViewData): Pick<NormalizedViewData, 'data' | 'rowVals' | 'colVals' | 'groupFields' | 'pivotFields' | 'agg' | 'totalCol' | 'totalRow' | 'grandTotal'> {
  const groupFields = raw.groupFields ?? [];
  const pivotFields = raw.pivotFields ?? [];
  const rowVals = (raw.rowVals ?? []).map((values) => rowValueArrayToObject(values, groupFields));
  const colVals = (raw.colVals ?? []).map((values) => pivotValueToDisplay(values));
  const agg = raw.agg;
  const cellResults = agg?.results?.cell ?? [];
  const matrix = rowVals.map((_, rowIndex) =>
    colVals.map((_, colIndex) =>
      buildAggregateRecord(agg?.info?.cell, cellResults.map((values) => values[rowIndex]?.[colIndex])),
    ),
  );

  return {
    data: matrix,
    rowVals,
    colVals,
    groupFields,
    pivotFields,
    agg: agg?.info?.cell ?? [],
    totalCol: rowVals.map((_, rowIndex) => buildAggregateRecord(agg?.info?.group, agg?.results?.group?.map((values) => values[rowIndex]))),
    totalRow: colVals.map((_, colIndex) => buildAggregateRecord(agg?.info?.pivot, agg?.results?.pivot?.map((values) => values[colIndex]))),
    grandTotal: buildAggregateRecord(agg?.info?.all, agg?.results?.all),
  };
}

function computeAggregateRecord(
  rows: LegacyRow[],
  aggregateSpecs: AggregateSpecItem[],
  typeInfo: unknown,
  dataByRowId: unknown,
): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};

  aggregateSpecs.forEach((spec, index) => {
    try {
      const info = new AggregateInfo('all', spec, index, null, typeInfo, (field: string) => {
        if (isObject(dataByRowId)) {
          Source.decodeAll(dataByRowId, field, typeInfo as LegacyOrdMap<unknown>);
        }
      }) as { instance: { calculate(data: LegacyRow[]): unknown } };
      const key = buildAggregateKey(spec);
      if (!key) return;
      aggregates[key] = info.instance.calculate(rows);
    } catch {
      // Ignore invalid aggregate definitions and let the upstream view continue handling them.
    }
  });

  return aggregates;
}

export function normalizeComputedViewData(rawData: unknown, typeInfo: unknown, aggregateSpec: unknown): NormalizedViewData | null {
  if (!isObject(rawData)) return null;

  const raw = rawData as LegacyViewData;
  const normalized: NormalizedViewData = {
    isPlain: Boolean(raw.isPlain),
    isGroup: Boolean(raw.isGroup),
    isPivot: Boolean(raw.isPivot),
    data: [],
  };

  if (raw.isPlain) {
    const plain = normalizePlainData(raw);
    normalized.data = plain.rows;
    normalized.dataByRowId = plain.dataByRowId;

    const aggregateSpecs = getPlainAggregateSpecs(aggregateSpec);
    if (aggregateSpecs.length > 0) {
      normalized.totalAggregates = computeAggregateRecord(raw.data as LegacyRow[], aggregateSpecs, typeInfo, raw.dataByRowId);
    }

    return normalized;
  }

  if (raw.isPivot) {
    Object.assign(normalized, normalizePivotData(raw));
    return normalized;
  }

  if (raw.isGroup) {
    Object.assign(normalized, normalizeGroupData(raw));
    normalized.totalAggregates = buildAggregateRecord(raw.agg?.info?.all, raw.agg?.results?.all);
    return normalized;
  }

  return normalized;
}

function getPlainAggregateSpecs(aggregateSpec: unknown): AggregateSpecItem[] {
  if (!isObject(aggregateSpec)) return [];

  const spec = aggregateSpec as Partial<AggregateSpecMap>;
  if (Array.isArray(spec.all)) return spec.all;
  if (Array.isArray(spec.group)) return spec.group;
  return [];
}

export function toLegacyAggregateSpec(specs: Array<{ fn: string; fields: string[] }> | null): AggregateSpecMap | null {
  if (!specs || specs.length === 0) return null;

  const normalizedSpecs = specs.map((spec) => ({
    fun: spec.fn,
    fields: spec.fields,
  }));

  return {
    group: normalizedSpecs,
    pivot: normalizedSpecs,
    cell: normalizedSpecs,
    all: normalizedSpecs,
  };
}

function inferTypeFromValue(value: unknown): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'string';
  if (value instanceof Date) return 'datetime';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value)) {
      return value.includes('T') || value.includes(' ') ? 'datetime' : 'date';
    }
    const numeric = Number(value.replaceAll(',', ''));
    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return 'number';
    }
  }
  return 'string';
}

export function buildLocalSourceTypeInfo(data: Record<string, unknown>[], columns: ColumnLike[] = []): Record<string, { field: string; type: string; format?: string; internalType?: string }> {
  const fields = new Set<string>(columns.map((column) => column.field));
  data.forEach((row) => {
    Object.keys(row).forEach((field) => fields.add(field));
  });

  return Object.fromEntries(
    [...fields].map((field) => {
      const column = columns.find((item) => item.field === field);
      const sample = data.find((row) => row[field] != null)?.[field];
      const type = normalizeSourceType(column?.typeInfo?.type ?? inferTypeFromValue(sample));

      return [field, {
        field,
        type,
        ...(type === 'number' ? { internalType: 'primitive' } : {}),
        ...(type === 'currency' ? { internalType: 'bignumber' } : {}),
        ...(column?.typeInfo?.format ? { format: column.typeInfo.format } : {}),
        ...(column?.typeInfo?.internalType ? { internalType: column.typeInfo.internalType } : {}),
      }];
    }),
  );
}

export function normalizeLocalSourceRows(
  data: Record<string, unknown>[],
  typeInfo: Record<string, { type: string }>,
): Record<string, unknown>[] {
  return data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([field, value]) => {
        const fieldType = typeInfo[field]?.type;
        if (fieldType === 'string' && value != null && typeof value !== 'string') {
          return [field, String(value)];
        }
        return [field, value];
      }),
    ),
  );
}

export function buildAggregateFunctions(): Array<{ name: string; label: string; fieldCount: number }> {
  const functions: Array<{ name: string; label: string; fieldCount: number }> = [];
  const registry = AGGREGATE_REGISTRY as { each: (fn: (value: { prototype: { enabled?: boolean; fieldCount?: number; getTransName?: () => string; name?: string } }, key: string) => void) => void };
  registry.each((AggregateCtor, key) => {
    if (AggregateCtor.prototype.enabled === false) return;
    functions.push({
      name: key,
      label: AggregateCtor.prototype.getTransName?.() ?? AggregateCtor.prototype.name ?? key,
      fieldCount: AggregateCtor.prototype.fieldCount ?? 0,
    });
  });
  return functions;
}