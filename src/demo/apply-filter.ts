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
        if (!looseEqual(raw, val)) return false;
        break;
      case '$ne':
        if (looseEqual(raw, val)) return false;
        break;

      // ── Comparison ─────────────────────────────
      case '$gt':
        if (toNum(raw) <= toNum(val)) return false;
        break;
      case '$gte':
        if (toNum(raw) < toNum(val)) return false;
        break;
      case '$lt':
        if (toNum(raw) >= toNum(val)) return false;
        break;
      case '$lte':
        if (toNum(raw) > toNum(val)) return false;
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
        if (set.length > 0 && !set.some((v) => looseEqual(raw, v))) return false;
        break;
      }
      case '$nin': {
        const set = Array.isArray(val) ? val : [val];
        if (set.some((v) => looseEqual(raw, v))) return false;
        break;
      }

      // ── Between (date / number range) ──────────
      case '$bet': {
        if (Array.isArray(val) && val.length === 2) {
          const n = toNum(raw);
          if (n < toNum(val[0]) || n > toNum(val[1])) return false;
        }
        break;
      }

      // Unsupported operators ($every, $this, $last) — pass through
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

/** Loose equality: compare as strings if types differ. */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Coerce to number for comparison operators. Dates become timestamps. */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const s = String(v ?? '');
  // Try ISO date string → timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
