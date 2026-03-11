import type { GroupSpec } from './group-adapter';

export interface AggregateSpec {
  fn: string;
  fields: string[];
}

export interface ViewSortSpec {
  vertical?: {
    field: string;
    dir: string;
  };
}

export interface GroupMetadataEntry {
  groupValues: Record<string, unknown>;
  count: number;
  level: number;
  aggregates: Record<string, unknown>;
}

export interface GroupTransformResult {
  groupMetadata?: Record<string, GroupMetadataEntry>;
  numGroups: number;
}

function getIsoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));
}

function formatQuarter(date: Date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function formatMonth(date: Date) {
  return date.toLocaleString('en-US', { month: 'long' });
}

function formatDayOfWeek(date: Date) {
  return date.toLocaleString('en-US', { weekday: 'long' });
}

function formatTimeSlice(date: Date, minutes: number) {
  const rounded = new Date(date);
  rounded.setMinutes(Math.floor(date.getMinutes() / minutes) * minutes, 0, 0);
  return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function applyGroupFunction(value: unknown, fun?: string): unknown {
  if (!fun) return value;
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return value;

  switch (fun) {
    case 'year':
      return String(date.getFullYear());
    case 'quarter':
      return formatQuarter(date);
    case 'month':
      return formatMonth(date);
    case 'week_iso':
      return `W${String(getIsoWeek(date)).padStart(2, '0')}`;
    case 'day_of_week':
      return formatDayOfWeek(date);
    case 'year_and_quarter':
      return `${date.getFullYear()} ${formatQuarter(date)}`;
    case 'year_and_month':
      return `${date.getFullYear()} ${formatMonth(date)}`;
    case 'year_and_week_iso':
      return `${date.getFullYear()} W${String(getIsoWeek(date)).padStart(2, '0')}`;
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'day_and_time_1hr':
      return `${date.toISOString().slice(0, 10)} ${formatTimeSlice(date, 60)}`;
    case 'day_and_time_15min':
      return `${date.toISOString().slice(0, 10)} ${formatTimeSlice(date, 15)}`;
    case 'time_1hr':
      return formatTimeSlice(date, 60);
    case 'time_15min':
      return formatTimeSlice(date, 15);
    default:
      return value;
  }
}

export function compareViewValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);

  const leftString = String(left);
  const rightString = String(right);

  const leftDate = Date.parse(leftString);
  const rightDate = Date.parse(rightString);
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate;

  const leftNumber = Number(leftString.replaceAll(',', ''));
  const rightNumber = Number(rightString.replaceAll(',', ''));
  if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber;

  return leftString.localeCompare(rightString);
}

export function sortRows<Row extends Record<string, unknown>>(rows: Row[], sortSpec: ViewSortSpec | null): Row[] {
  if (!sortSpec?.vertical) return [...rows];

  const { field, dir } = sortSpec.vertical;
  const direction = dir === 'DESC' ? -1 : 1;
  return [...rows].sort((left, right) => compareViewValues(left[field], right[field]) * direction);
}

export function computeAggregateValue(rows: Record<string, unknown>[], aggregateSpec: AggregateSpec): unknown {
  const field = aggregateSpec.fields[0];
  if (aggregateSpec.fn === 'count') return rows.length;
  if (!field) return null;

  if (aggregateSpec.fn === 'counta') {
    return rows.filter((row) => row[field] != null && row[field] !== '').length;
  }
  if (aggregateSpec.fn === 'countu') {
    return new Set(rows.map((row) => row[field]).filter((value) => value != null && value !== '')).size;
  }
  if (aggregateSpec.fn === 'list') {
    const uniqueValues = [...new Set(rows.map((row) => row[field]).filter((value) => value != null && value !== '').map(String))];
    return uniqueValues.join(', ');
  }

  const numbers = rows.map((row) => Number(row[field])).filter((value) => !Number.isNaN(value));
  if (aggregateSpec.fn === 'sum') return numbers.reduce((sum, value) => sum + value, 0);
  if (aggregateSpec.fn === 'avg') return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  if (aggregateSpec.fn === 'min') return numbers.length ? Math.min(...numbers) : null;
  if (aggregateSpec.fn === 'max') return numbers.length ? Math.max(...numbers) : null;
  return null;
}

export function computeAggregateMap(rows: Record<string, unknown>[], aggregateSpecs: AggregateSpec[]): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  for (const aggregateSpec of aggregateSpecs) {
    const field = aggregateSpec.fields[0];
    const label = field ? `${aggregateSpec.fn}(${field})` : aggregateSpec.fn;
    aggregates[label] = computeAggregateValue(rows, aggregateSpec);
  }
  return aggregates;
}

export function buildGroupMetadata<Row extends Record<string, unknown>>(
  rows: Row[],
  groupSpec: GroupSpec | null,
  aggregateSpecs: AggregateSpec[] | null,
): GroupTransformResult {
  const groupFieldSpecs = groupSpec?.fieldNames ?? [];
  if (groupFieldSpecs.length === 0) {
    return { numGroups: 0 };
  }

  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const key = groupFieldSpecs
      .map((fieldInfo) => String(applyGroupFunction(row[fieldInfo.field], fieldInfo.fun) ?? ''))
      .join('|||');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)?.push(row);
  }

  const groupMetadata: Record<string, GroupMetadataEntry> = {};
  for (const [key, bucketRows] of buckets) {
    groupMetadata[key] = {
      groupValues: Object.fromEntries(
        groupFieldSpecs.map((fieldInfo) => [fieldInfo.field, applyGroupFunction(bucketRows[0]?.[fieldInfo.field], fieldInfo.fun)]),
      ),
      count: bucketRows.length,
      level: 0,
      aggregates: aggregateSpecs?.length ? computeAggregateMap(bucketRows, aggregateSpecs) : {},
    };
  }

  return {
    groupMetadata,
    numGroups: buckets.size,
  };
}