/**
 * FilterOperatorSelect — operator dropdown for filter components.
 *
 * Renders a compact `<select>` with the available operators for a filter type.
 */

import type { FilterOperator, OperatorInfo } from './types';

export interface FilterOperatorSelectProps {
  /** Available operators */
  operators: OperatorInfo[];
  /** Currently selected operator */
  value: FilterOperator;
  /** Change handler */
  onChange: (op: FilterOperator) => void;
  /** Accessible label */
  'aria-label'?: string;
  /** i18n function */
  trans?: (key: string) => string;
}

export function FilterOperatorSelect({
  operators,
  value,
  onChange,
  'aria-label': ariaLabel,
}: FilterOperatorSelectProps) {
  return (
    <select
      className="wcdv-filter-operator h-7 rounded border border-gray-300 bg-white text-xs px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value as FilterOperator)}
      aria-label={ariaLabel ?? 'Filter operator'}
    >
      {operators.map((op) => (
        <option key={op.value} value={op.value}>
          {op.label}
        </option>
      ))}
    </select>
  );
}
