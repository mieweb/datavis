/**
 * Group function registry adapter — bridges `GROUP_FUNCTION_REGISTRY`
 * from wcdatavis/src/group_fun.js into the React `GroupFunction` shape
 * used by GroupFunctionDialog.
 *
 * Also provides helpers for type-based groupability checks and
 * building compatible group specs.
 */

import type { GroupFunction } from '../components/dialogs/GroupFunctionDialog';

// ───────────────────────────────────────────────────────────
// Types matching wcdatavis internals
// ───────────────────────────────────────────────────────────

/** Shape of a single entry in the wcdatavis GROUP_FUNCTION_REGISTRY OrdMap. */
export interface LegacyGroupFunction {
  category: string;
  transLabel: string;
  allowedTypes?: string[];
  resultType?: string;
  sortType?: string;
  canFilter?: boolean;
  getDisplayName?: () => string;
  getTransName?: () => string;
}

/** wcdatavis OrdMap — minimal interface for iteration. */
export interface OrdMap<V = unknown> {
  keys(): string[];
  get(key: string): V | undefined;
  each(fn: (value: V, key: string) => void): void;
}

// ───────────────────────────────────────────────────────────
// Group spec types — matches ComputedView~GroupSpec
// ───────────────────────────────────────────────────────────

/** A single field entry in a group/pivot spec. */
export interface GroupFieldSpec {
  field: string;
  fun?: string;
}

/** Full group or pivot specification passed to view.setGroup()/setPivot(). */
export interface GroupSpec {
  fieldNames: GroupFieldSpec[];
}

// ───────────────────────────────────────────────────────────
// Registry adapter
// ───────────────────────────────────────────────────────────

/**
 * Convert the wcdatavis GROUP_FUNCTION_REGISTRY into an array of
 * React-friendly GroupFunction definitions for the dialog.
 *
 * @param registry - The OrdMap from `import {GROUP_FUNCTION_REGISTRY} from 'group_fun.js'`
 * @param trans - Optional translation function (falls back to transLabel key).
 */
export function adaptGroupFunctionRegistry(
  registry: OrdMap<LegacyGroupFunction>,
  trans?: (key: string) => string,
): GroupFunction[] {
  const result: GroupFunction[] = [];
  registry.each((gf, name) => {
    const category = normalizeCategory(gf.category);
    const label = trans
      ? trans(gf.transLabel) || name
      : gf.getDisplayName?.() ?? gf.getTransName?.() ?? name;
    result.push({ name, label, category });
  });
  return result;
}

/**
 * Build static group function definitions matching wcdatavis
 * GROUP_FUNCTION_REGISTRY without importing the actual module.
 * Use this when the legacy JS module isn't available at import time.
 */
export function getBuiltinGroupFunctions(
  trans?: (key: string) => string,
): GroupFunction[] {
  const t = (key: string, fallback: string) => (trans ? trans(key) || fallback : fallback);

  return [
    // Repeating
    { name: 'quarter',        label: t('GRID.GROUP_FUN.REPEATING.QUARTER', 'Quarter'),             category: 'repeating' },
    { name: 'month',          label: t('GRID.GROUP_FUN.REPEATING.MONTH', 'Month'),                 category: 'repeating' },
    { name: 'week_iso',       label: t('GRID.GROUP_FUN.REPEATING.WEEK', 'ISO Week'),               category: 'repeating' },
    { name: 'day_of_week',    label: t('GRID.GROUP_FUN.REPEATING.DAY_OF_WEEK', 'Day of Week'),     category: 'repeating' },
    // Date
    { name: 'year',           label: t('GRID.GROUP_FUN.DATE.YEAR', 'Year'),                        category: 'date' },
    { name: 'year_and_quarter', label: t('GRID.GROUP_FUN.DATE.YEAR_AND_QUARTER', 'Year & Quarter'), category: 'date' },
    { name: 'year_and_month', label: t('GRID.GROUP_FUN.DATE.YEAR_AND_MONTH', 'Year & Month'),      category: 'date' },
    { name: 'year_and_week_iso', label: t('GRID.GROUP_FUN.DATE.YEAR_AND_WEEK', 'Year & Week'),     category: 'date' },
    { name: 'day',            label: t('GRID.GROUP_FUN.DATE.FULL_DATE', 'Full Date'),               category: 'date' },
    // DateTime
    { name: 'day_and_time_1hr',  label: t('GRID.GROUP_FUN.DATE_TIME.SLICE.1HR', '1 Hour Slice'),   category: 'datetime' },
    { name: 'day_and_time_15min', label: t('GRID.GROUP_FUN.DATE_TIME.SLICE.15MIN', '15 Min Slice'), category: 'datetime' },
    // Time
    { name: 'time_1hr',      label: t('GRID.GROUP_FUN.TIME.SLICE.1HR', '1 Hour Slice'),            category: 'time' },
    { name: 'time_15min',    label: t('GRID.GROUP_FUN.TIME.SLICE.15MIN', '15 Min Slice'),          category: 'time' },
  ];
}

/**
 * Map of group function name → allowed field types.
 * Used to filter which functions are available for a given field type.
 */
export const GROUP_FUNCTION_ALLOWED_TYPES: Record<string, string[]> = {
  quarter:            ['date', 'datetime'],
  month:              ['date', 'datetime'],
  week_iso:           ['date', 'datetime'],
  day_of_week:        ['date', 'datetime'],
  year:               ['date', 'datetime'],
  year_and_quarter:   ['date', 'datetime'],
  year_and_month:     ['date', 'datetime'],
  year_and_week_iso:  ['date', 'datetime'],
  day:                ['datetime'],
  day_and_time_1hr:   ['datetime'],
  day_and_time_15min: ['datetime'],
  time_1hr:           ['time'],
  time_15min:         ['time'],
};

/**
 * Filter group functions to those allowed for a given field type.
 */
export function filterGroupFunctionsForType(
  functions: GroupFunction[],
  fieldType: string,
): GroupFunction[] {
  return functions.filter((gf) => {
    const allowed = GROUP_FUNCTION_ALLOWED_TYPES[gf.name];
    // If no restriction defined, allow for all groupable types
    return !allowed || allowed.includes(fieldType);
  });
}

// ───────────────────────────────────────────────────────────
// Type groupability
// ───────────────────────────────────────────────────────────

/** Types that wcdatavis considers groupable (supports.group === true). */
const GROUPABLE_TYPES = new Set([
  'string', 'number', 'integer', 'boolean', 'date', 'datetime', 'time',
  'currency', 'percent', 'month', 'day_of_week',
]);

/** Types that benefit from a group function (date/time types). */
const TYPES_NEEDING_GROUP_FN = new Set(['date', 'datetime', 'time']);

/**
 * Check whether a field type supports grouping.
 * Compatible with `types.registry.get(type).supports.group` from wcdatavis.
 */
export function supportsGroup(fieldType: string): boolean {
  return GROUPABLE_TYPES.has(fieldType);
}

/**
 * Check whether a field type should auto-open the group function dialog when
 * added to a group section (matches legacy autoShowFunWin behavior).
 */
export function needsGroupFunction(fieldType: string): boolean {
  return TYPES_NEEDING_GROUP_FN.has(fieldType);
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

function normalizeCategory(cat: string): GroupFunction['category'] {
  switch (cat) {
    case 'repeating': return 'repeating';
    case 'date': return 'date';
    case 'datetime': return 'datetime';
    case 'time': return 'time';
    default: return 'other';
  }
}

/**
 * Build a legacy-compatible GroupSpec from enriched field items.
 */
export function buildGroupSpec(
  fields: { field: string; fun?: string }[],
): GroupSpec {
  return {
    fieldNames: fields.map((f) => {
      const entry: GroupFieldSpec = { field: f.field };
      if (f.fun && f.fun !== 'none') {
        entry.fun = f.fun;
      }
      return entry;
    }),
  };
}

/**
 * Find the label for a group function name.
 */
export function getGroupFunctionLabel(
  functions: GroupFunction[],
  funName: string | undefined,
): string | undefined {
  if (!funName || funName === 'none') return undefined;
  return functions.find((gf) => gf.name === funName)?.label;
}
