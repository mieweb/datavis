import type { FilterSpec, FieldFilterSpec, FilterOperator } from './types';

export type FilterableRow = Record<string, unknown>;

function toComparable(value: unknown): string | number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'boolean') return Number(value);
  if (value instanceof Date) return value.getTime();

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    const date = new Date(stringValue);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  const numericValue = Number(stringValue.replaceAll(',', ''));
  if (!Number.isNaN(numericValue)) return numericValue;

  return stringValue.toLowerCase();
}

function getNow(): Date {
  return new Date();
}

function getIsoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));
}

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3);
}

function matchesCurrentPeriod(date: Date, period: unknown): boolean {
  const now = getNow();
  const periodName = String(period ?? '');

  if (periodName === 'day') {
    return date.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  }
  if (periodName === 'week') {
    return date.getFullYear() === now.getFullYear() && getIsoWeek(date) === getIsoWeek(now);
  }
  if (periodName === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }
  if (periodName === 'quarter') {
    return date.getFullYear() === now.getFullYear() && getQuarter(date) === getQuarter(now);
  }
  if (periodName === 'year') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

function matchesLastPeriod(date: Date, period: unknown): boolean {
  const now = getNow();
  const periodName = String(period ?? '');
  const last = new Date(now);

  if (periodName === 'day') {
    last.setDate(now.getDate() - 1);
    return date.toISOString().slice(0, 10) === last.toISOString().slice(0, 10);
  }
  if (periodName === 'week') {
    last.setDate(now.getDate() - 7);
    return date.getFullYear() === last.getFullYear() && getIsoWeek(date) === getIsoWeek(last);
  }
  if (periodName === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() - 1;
  }
  if (periodName === 'quarter') {
    const lastQuarter = getQuarter(now) - 1;
    if (lastQuarter >= 0) {
      return date.getFullYear() === now.getFullYear() && getQuarter(date) === lastQuarter;
    }
    return date.getFullYear() === now.getFullYear() - 1 && getQuarter(date) === 3;
  }
  if (periodName === 'year') {
    return date.getFullYear() === now.getFullYear() - 1;
  }

  return true;
}

function matchesEvery(date: Date, value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;

  const spec = value as { unit?: unknown; value?: unknown };
  const unit = String(spec.unit ?? '');
  const target = String(spec.value ?? '');

  if (unit === 'day') {
    return String(date.getUTCDay()) === target;
  }
  if (unit === 'month') {
    return String(date.getUTCMonth()) === target;
  }

  return true;
}

function compareComparable(left: unknown, right: unknown): number {
  const leftValue = toComparable(left);
  const rightValue = toComparable(right);

  if (leftValue == null && rightValue == null) return 0;
  if (leftValue == null) return -1;
  if (rightValue == null) return 1;
  if (typeof leftValue === 'number' && typeof rightValue === 'number') return leftValue - rightValue;

  return String(leftValue).localeCompare(String(rightValue));
}

export function matchesFieldFilter(row: FilterableRow, field: string, fieldSpec: FieldFilterSpec): boolean {
  const raw = row[field];

  for (const [op, value] of Object.entries(fieldSpec) as [FilterOperator, unknown][]) {
    switch (op) {
      case '$exists':
        if (raw == null || raw === '') return false;
        break;
      case '$notexists':
        if (raw != null && raw !== '') return false;
        break;
      case '$eq':
        if (compareComparable(raw, value) !== 0) return false;
        break;
      case '$ne':
        if (compareComparable(raw, value) === 0) return false;
        break;
      case '$gt':
        if (compareComparable(raw, value) <= 0) return false;
        break;
      case '$gte':
        if (compareComparable(raw, value) < 0) return false;
        break;
      case '$lt':
        if (compareComparable(raw, value) >= 0) return false;
        break;
      case '$lte':
        if (compareComparable(raw, value) > 0) return false;
        break;
      case '$contains': {
        const haystack = String(raw ?? '').toLowerCase();
        const needle = String(value ?? '').toLowerCase();
        if (needle && !haystack.includes(needle)) return false;
        break;
      }
      case '$notcontains': {
        const haystack = String(raw ?? '').toLowerCase();
        const needle = String(value ?? '').toLowerCase();
        if (needle && haystack.includes(needle)) return false;
        break;
      }
      case '$in': {
        const set = Array.isArray(value) ? value : [value];
        if (set.length > 0 && !set.some((entry) => compareComparable(raw, entry) === 0)) return false;
        break;
      }
      case '$nin': {
        const set = Array.isArray(value) ? value : [value];
        if (set.some((entry) => compareComparable(raw, entry) === 0)) return false;
        break;
      }
      case '$bet': {
        if (Array.isArray(value) && value.length === 2) {
          if (compareComparable(raw, value[0]) < 0 || compareComparable(raw, value[1]) > 0) return false;
        }
        break;
      }
      case '$this': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesCurrentPeriod(date, value)) return false;
        break;
      }
      case '$last': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesLastPeriod(date, value)) return false;
        break;
      }
      case '$every': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesEvery(date, value)) return false;
        break;
      }
      default:
        break;
    }
  }

  return true;
}

export function applyFilter<Row extends FilterableRow>(rows: Row[], spec: FilterSpec): Row[] {
  const fields = Object.keys(spec);
  if (fields.length === 0) return rows;

  return rows.filter((row) => fields.every((field) => matchesFieldFilter(row, field, spec[field])));
}