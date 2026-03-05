/**
 * FilterOperatorSelect — operator dropdown for filter components.
 *
 * Renders a compact `<select>` with the available operators for a filter type.
 * After user selects an operator, focus automatically moves to the next
 * value input (text, date, button) within the same filter widget.
 */

import { useRef, useEffect, useCallback } from 'react';
import type { FilterOperator, OperatorInfo } from './types';

/**
 * Find the next focusable element inside the closest `.wcdv-filter` container
 * (skipping the operator select itself). If the element is a `<button>` it will
 * be clicked to open dropdowns automatically.
 */
function focusNextValueElement(selectEl: HTMLSelectElement) {
  const filter = selectEl.closest('.wcdv-filter');
  if (!filter) return;

  const focusable = filter.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]), select, button, [tabindex]:not([tabindex="-1"])',
  );

  for (const el of focusable) {
    if (el === selectEl) continue;
    // Skip tiny remove / clear buttons
    if (el.closest('.wcdv-filter-remove')) continue;
    el.focus();
    // If it's a button (e.g. multi-select trigger), click to open
    if (el.tagName === 'BUTTON') el.click();
    // If it's a date/datetime input, open the picker
    if (el instanceof HTMLInputElement && (el.type === 'date' || el.type === 'datetime-local')) {
      try {
        el.showPicker();
      } catch {
        // showPicker() not supported — focus is enough
      }
    }
    return;
  }
}

export interface FilterOperatorSelectProps {
  /** Available operators */
  operators: OperatorInfo[];
  /** Currently selected operator */
  value: FilterOperator;
  /** Change handler */
  onChange: (op: FilterOperator) => void;
  /** Accessible label */
  'aria-label'?: string;
  /** Auto-focus and open on mount */
  autoFocus?: boolean;
  /** i18n function */
  trans?: (key: string) => string;
}

export function FilterOperatorSelect({
  operators,
  value,
  onChange,
  'aria-label': ariaLabel,
  autoFocus,
}: FilterOperatorSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!autoFocus || !selectRef.current) return;
    const el = selectRef.current;
    requestAnimationFrame(() => {
      el.focus();
      try {
        el.showPicker();
      } catch {
        // showPicker() not supported — focus is enough
      }
    });
  }, [autoFocus]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const op = e.target.value as FilterOperator;
      onChange(op);

      // After selecting an operator, move focus to the value input
      // Use rAF to let React re-render (operator may show/hide inputs)
      requestAnimationFrame(() => {
        if (selectRef.current) {
          focusNextValueElement(selectRef.current);
        }
      });
    },
    [onChange],
  );

  return (
    <select
      ref={selectRef}
      className="wcdv-filter-operator h-7 rounded border border-gray-300 bg-white text-xs px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
      value={value}
      onChange={handleChange}
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
