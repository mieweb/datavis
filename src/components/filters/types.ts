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
  /** i18n key for the operator label */
  label: string;
  /** Optional Unicode prefix symbol (e.g. ∈, ≠, >) */
  symbol?: string;
  /** Whether this operator hides the value input (e.g. $exists, $notexists) */
  noInput?: boolean;
}

/** Operators for string fields */
export const STRING_OPERATORS: OperatorInfo[] = [
  { value: '$contains', label: 'FILTER.STRING.OPERATOR.CONTAINS', symbol: '∈' },
  { value: '$notcontains', label: 'FILTER.STRING.OPERATOR.NOT_CONTAINS', symbol: '∉' },
  { value: '$eq', label: 'FILTER.STRING.OPERATOR.EQUALS', symbol: '=' },
  { value: '$ne', label: 'FILTER.STRING.OPERATOR.NOT_EQUALS', symbol: '≠' },
  { value: '$in', label: 'FILTER.STRING.OPERATOR.IN' },
  { value: '$nin', label: 'FILTER.STRING.OPERATOR.NOT_IN' },
  { value: '$exists', label: 'FILTER.STRING.OPERATOR.NOT_BLANK', noInput: true },
  { value: '$notexists', label: 'FILTER.STRING.OPERATOR.BLANK', noInput: true },
];

/** Operators for number / currency fields */
export const NUMBER_OPERATORS: OperatorInfo[] = [
  { value: '$eq', label: 'FILTER.NUMBER.OPERATOR.EQUALS', symbol: '=' },
  { value: '$ne', label: 'FILTER.NUMBER.OPERATOR.NOT_EQUALS', symbol: '≠' },
  { value: '$gt', label: 'FILTER.NUMBER.OPERATOR.GREATER_THAN', symbol: '>' },
  { value: '$gte', label: 'FILTER.NUMBER.OPERATOR.GREATER_OR_EQUAL', symbol: '≥' },
  { value: '$lt', label: 'FILTER.NUMBER.OPERATOR.LESS_THAN', symbol: '<' },
  { value: '$lte', label: 'FILTER.NUMBER.OPERATOR.LESS_OR_EQUAL', symbol: '≤' },
  { value: '$exists', label: 'FILTER.NUMBER.OPERATOR.NOT_BLANK', noInput: true },
  { value: '$notexists', label: 'FILTER.NUMBER.OPERATOR.BLANK', noInput: true },
];

/** Operators for date / datetime fields */
export const DATE_OPERATORS: OperatorInfo[] = [
  { value: '$eq', label: 'FILTER.DATE.OPERATOR.ON' },
  { value: '$bet', label: 'FILTER.DATE.OPERATOR.BETWEEN' },
  { value: '$lte', label: 'FILTER.DATE.OPERATOR.BEFORE' },
  { value: '$gte', label: 'FILTER.DATE.OPERATOR.AFTER' },
  { value: '$every', label: 'FILTER.DATE.OPERATOR.EVERY' },
  { value: '$this', label: 'FILTER.DATE.OPERATOR.CURRENT' },
  { value: '$last', label: 'FILTER.DATE.OPERATOR.LAST' },
  { value: '$exists', label: 'FILTER.DATE.OPERATOR.NOT_BLANK', noInput: true },
  { value: '$notexists', label: 'FILTER.DATE.OPERATOR.BLANK', noInput: true },
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
