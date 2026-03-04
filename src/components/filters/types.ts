/**
 * Filter types — shared type definitions for all filter components.
 *
 * Models the wcdatavis filter spec language:
 *   { fieldName: { $operator: value, ... }, ... }
 */

// ───────────────────────────────────────────────────────────
// Operators
// ───────────────────────────────────────────────────────────

/** All supported filter operators */
export type FilterOperator =
  | '$contains'
  | '$notcontains'
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$exists'
  | '$notexists'
  | '$bet'
  | '$every'
  | '$this'
  | '$last';

/** Operator display metadata */
export interface OperatorInfo {
  /** Operator key */
  value: FilterOperator;
  /** Display label (unicode symbol or short text) */
  label: string;
  /** Whether this operator hides the value input (e.g. $exists, $notexists) */
  noInput?: boolean;
}

/** Operators for string fields */
export const STRING_OPERATORS: OperatorInfo[] = [
  { value: '$contains', label: '∈ contains' },
  { value: '$notcontains', label: '∉ not contains' },
  { value: '$eq', label: '= equals' },
  { value: '$ne', label: '≠ not equals' },
  { value: '$in', label: 'in' },
  { value: '$nin', label: 'not in' },
  { value: '$exists', label: 'not blank', noInput: true },
  { value: '$notexists', label: 'blank', noInput: true },
];

/** Operators for number / currency fields */
export const NUMBER_OPERATORS: OperatorInfo[] = [
  { value: '$eq', label: '= equals' },
  { value: '$ne', label: '≠ not equals' },
  { value: '$gt', label: '> greater than' },
  { value: '$gte', label: '≥ greater or equal' },
  { value: '$lt', label: '< less than' },
  { value: '$lte', label: '≤ less or equal' },
  { value: '$exists', label: 'not blank', noInput: true },
  { value: '$notexists', label: 'blank', noInput: true },
];

/** Operators for date / datetime fields */
export const DATE_OPERATORS: OperatorInfo[] = [
  { value: '$eq', label: 'on' },
  { value: '$bet', label: 'between' },
  { value: '$lte', label: 'before' },
  { value: '$gte', label: 'after' },
  { value: '$every', label: 'every' },
  { value: '$this', label: 'current' },
  { value: '$last', label: 'last' },
  { value: '$exists', label: 'not blank', noInput: true },
  { value: '$notexists', label: 'blank', noInput: true },
];

// ───────────────────────────────────────────────────────────
// Filter spec
// ───────────────────────────────────────────────────────────

/** A single field's filter value */
export type FieldFilterSpec = Partial<Record<FilterOperator, unknown>>;

/** Complete filter spec keyed by field name */
export type FilterSpec = Record<string, FieldFilterSpec>;

// ───────────────────────────────────────────────────────────
// Column config
// ───────────────────────────────────────────────────────────

/** The type family a column belongs to, governing which filter widget to show */
export type FilterType = 'string' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean';

/** Filter widget variant hint from column config */
export type FilterWidget =
  | 'textbox'
  | 'dropdown'
  | 'checkbox'
  | 'tribool'
  | 'single'
  | 'range'
  | 'neon';

/** Column configuration relevant to filtering */
export interface ColumnFilterConfig {
  /** Field name (key in data rows) */
  field: string;
  /** Human-readable column name */
  displayName: string;
  /** Type family for selecting the filter component */
  filterType: FilterType;
  /** Preferred widget variant (optional — a sensible default is chosen) */
  widget?: FilterWidget;
  /** For dropdown filters: available option values */
  options?: string[];
  /** Operators to include (override default set) */
  includeOperators?: FilterOperator[];
  /** Operators to exclude */
  excludeOperators?: FilterOperator[];
  /** Whether the column is currently visible */
  visible?: boolean;
}

// ───────────────────────────────────────────────────────────
// Date sub-types
// ───────────────────────────────────────────────────────────

/** "Every" period units for the $every operator */
export type EveryUnit = 'day' | 'month';

/** "Current/Last" period units for $this / $last operators */
export type PeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';
