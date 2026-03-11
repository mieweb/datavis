/**
 * Client-side filter engine for the demo app.
 *
 * Evaluates a FilterSpec (from the FilterBar) against an array of data rows,
 * returning only the rows that match ALL field conditions (AND logic).
 *
 * Supports the operator set defined in src/components/filters/types.ts:
 *   $contains, $notcontains, $eq, $ne, $gt, $gte, $lt, $lte,
 *   $in, $nin, $exists, $notexists, $bet
 */

import type { FilterSpec, FieldFilterSpec, FilterOperator } from '../components/filters/types';

type Row = Record<string, unknown>;

function toComparable(v: unknown): string | number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || typeof v === 'boolean') return Number(v);
  if (v instanceof Date) return v.getTime();

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const numeric = Number(s.replaceAll(',', ''));
  if (!Number.isNaN(numeric)) return numeric;

  return s.toLowerCase();
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
  const a = toComparable(left);
  const b = toComparable(right);
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/** Returns true if `row` passes the single-field filter. */
function matchesField(row: Row, field: string, fieldSpec: FieldFilterSpec): boolean {
  const raw = row[field];

  for (const [op, val] of Object.entries(fieldSpec) as [FilterOperator, unknown][]) {
    switch (op) {
      // ── Existence ──────────────────────────────
      case '$exists':
        if (raw == null || raw === '') return false;
        break;
      case '$notexists':
        if (raw != null && raw !== '') return false;
        break;

      // ── Equality ───────────────────────────────
      case '$eq':
        if (compareComparable(raw, val) !== 0) return false;
        break;
      case '$ne':
        if (compareComparable(raw, val) === 0) return false;
        break;

      // ── Comparison ─────────────────────────────
      case '$gt':
        if (compareComparable(raw, val) <= 0) return false;
        break;
      case '$gte':
        if (compareComparable(raw, val) < 0) return false;
        break;
      case '$lt':
        if (compareComparable(raw, val) >= 0) return false;
        break;
      case '$lte':
        if (compareComparable(raw, val) > 0) return false;
        break;

      // ── String contains ────────────────────────
      case '$contains': {
        const haystack = String(raw ?? '').toLowerCase();
        const needle = String(val ?? '').toLowerCase();
        if (needle && !haystack.includes(needle)) return false;
        break;
      }
      case '$notcontains': {
        const haystack = String(raw ?? '').toLowerCase();
        const needle = String(val ?? '').toLowerCase();
        if (needle && haystack.includes(needle)) return false;
        break;
      }

      // ── Set membership ─────────────────────────
      case '$in': {
        const set = Array.isArray(val) ? val : [val];
        if (set.length > 0 && !set.some((v) => compareComparable(raw, v) === 0)) return false;
        break;
      }
      case '$nin': {
        const set = Array.isArray(val) ? val : [val];
        if (set.some((v) => compareComparable(raw, v) === 0)) return false;
        break;
      }

      // ── Between (date / number range) ──────────
      case '$bet': {
        if (Array.isArray(val) && val.length === 2) {
          if (compareComparable(raw, val[0]) < 0 || compareComparable(raw, val[1]) > 0) return false;
        }
        break;
      }

      case '$this': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesCurrentPeriod(date, val)) return false;
        break;
      }

      case '$last': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesLastPeriod(date, val)) return false;
        break;
      }

      case '$every': {
        const date = new Date(String(raw ?? ''));
        if (Number.isNaN(date.getTime()) || !matchesEvery(date, val)) return false;
        break;
      }

      default:
        break;
    }
  }

  return true;
}

/** Apply a complete FilterSpec to an array of rows — returns matching rows. */
export function applyFilter(rows: Row[], spec: FilterSpec): Row[] {
  const fields = Object.keys(spec);
  if (fields.length === 0) return rows;

  return rows.filter((row) =>
    fields.every((field) => matchesField(row, field, spec[field])),
  );
}

// ── Helpers ──────────────────────────────────────────────

