/**
 * FilterOperatorSelect — operator dropdown for filter components.
 *
 * Renders a compact select with the available operators for a filter type.
 * After user selects an operator, focus automatically moves to the next
 * value input (text, date, button) within the same filter widget.
 */

import { useRef, useEffect, useCallback } from 'react';
import { Select } from '@mieweb/ui/components/Select';
import { useTranslation } from 'react-i18next';
import type { FilterOperator, OperatorInfo } from './types';

/**
 * Find the next focusable element inside the closest `.wcdv-filter` container
 * (skipping the operator select itself). If the element is a button-like trigger it will
 * be clicked to open dropdowns automatically.
 */
function focusNextValueElement(operatorRoot: HTMLElement) {
  const filter = operatorRoot.closest('.wcdv-filter');
  if (!filter) return;

  const focusable = filter.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]), select, button, [role="combobox"], [tabindex]:not([tabindex="-1"])',
  );

  for (const el of focusable) {
    if (operatorRoot.contains(el)) continue;
    // Skip tiny remove / clear buttons
    if (el.closest('.wcdv-filter-remove')) continue;
    el.focus();
    // If it's a button-like trigger (e.g. select or multi-select trigger), click to open
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'combobox') el.click();
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
  autoFocusOnMount?: boolean;
}

export function FilterOperatorSelect({
  operators,
  value,
  onChange,
  'aria-label': ariaLabel,
  autoFocusOnMount,
}: FilterOperatorSelectProps) {
  const { t } = useTranslation();
  const selectRef = useRef<HTMLDivElement>(null);

  const focusOperatorTrigger = useCallback(() => {
    const trigger = selectRef.current?.querySelector<HTMLElement>('[role="combobox"], button');
    if (!trigger) return;
    trigger.focus();
    trigger.click();
  }, []);

  useEffect(() => {
    if (!autoFocusOnMount) return;
    requestAnimationFrame(() => {
      focusOperatorTrigger();
    });
  }, [autoFocusOnMount, focusOperatorTrigger]);

  const handleChange = useCallback(
    (nextValue: string) => {
      const op = nextValue as FilterOperator;
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
    <div
      ref={selectRef}
      className="wcdv-filter-operator min-w-[7rem]"
    >
      <Select
        size="sm"
        hideLabel
        label={ariaLabel ?? (t('FILTER.OPERATOR') || 'Filter operator')}
        className="text-xs"
        options={operators.map((op) => ({
          value: op.value,
          label: op.symbol ? `${op.symbol} ${t(op.label)}` : t(op.label),
        }))}
      value={value}
        onValueChange={handleChange}
      />
    </div>
  );
}
