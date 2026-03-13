/**
 * NumberFilter — filter component for number and currency columns.
 *
 * Supports three widget variants:
 *  - textbox: numeric input with operator dropdown
 *  - checkbox: simple on/off (value 0 or 1)
 *  - tribool: three-state radio (True / False / Both)
 */

import { useState, useCallback } from 'react';
import { Input } from '@mieweb/ui/components/Input';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Radio, RadioGroup } from '@mieweb/ui/components/Radio';
import { useTranslation } from 'react-i18next';
import { FilterOperatorSelect } from './FilterOperatorSelect';
import {
  NUMBER_OPERATORS,
  type FilterOperator,
  type FieldFilterSpec,
} from './types';

export interface NumberFilterProps {
  /** Field name */
  field: string;
  /** Display label */
  label: string;
  /** Widget variant */
  widget?: 'textbox' | 'checkbox' | 'tribool';
  /** Operators to include */
  includeOperators?: FilterOperator[];
  /** Operators to exclude */
  excludeOperators?: FilterOperator[];
  /** Current filter value */
  value?: FieldFilterSpec;
  /** Change handler */
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
  /** Auto-focus the operator select on mount */
  autoFocus?: boolean;
}

export function NumberFilter({
  field,
  label,
  widget = 'textbox',
  includeOperators,
  excludeOperators,
  value,
  onChange,
  autoFocus,
}: NumberFilterProps) {
  if (widget === 'checkbox') {
    return (
      <NumberCheckboxFilter
        field={field}
        label={label}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (widget === 'tribool') {
    return (
      <NumberTriBoolFilter
        field={field}
        label={label}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <NumberTextboxFilter
      field={field}
      label={label}
      includeOperators={includeOperators}
      excludeOperators={excludeOperators}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
    />
  );
}

// ───────────────────────────────────────────────────────────
// Textbox variant
// ───────────────────────────────────────────────────────────

function NumberTextboxFilter({
  field,
  label,
  includeOperators,
  excludeOperators,
  value,
  onChange,
  autoFocus,
}: Omit<NumberFilterProps, 'widget'>) {
  const { t } = useTranslation();
  const operators = NUMBER_OPERATORS.filter((op) => {
    if (includeOperators?.length) return includeOperators.includes(op.value);
    if (excludeOperators?.length) return !excludeOperators.includes(op.value);
    return true;
  });

  const initialOp = value ? (Object.keys(value)[0] as FilterOperator) : '$eq';
  const initialVal = value?.[initialOp];

  const [operator, setOperator] = useState<FilterOperator>(initialOp);
  const [textValue, setTextValue] = useState(
    initialVal != null ? String(initialVal) : '',
  );

  const isNoInput = operators.find((o) => o.value === operator)?.noInput;

  const emitChange = useCallback(
    (op: FilterOperator, text: string) => {
      const info = operators.find((o) => o.value === op);
      if (info?.noInput) {
        onChange(field, { [op]: true });
        return;
      }
      const num = parseFloat(text);
      if (text.trim() === '' || isNaN(num)) {
        onChange(field, null);
      } else {
        onChange(field, { [op]: num });
      }
    },
    [field, onChange, operators],
  );

  const handleOperatorChange = useCallback(
    (op: FilterOperator) => {
      setOperator(op);
      emitChange(op, textValue);
    },
    [textValue, emitChange],
  );

  const handleTextCommit = useCallback(() => {
    emitChange(operator, textValue);
  }, [operator, textValue, emitChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') emitChange(operator, textValue);
    },
    [operator, textValue, emitChange],
  );

  return (
    <div className="wcdv-filter wcdv-filter-number flex items-center gap-1">
      <FilterOperatorSelect
        operators={operators}
        value={operator}
        onChange={handleOperatorChange}
        aria-label={`${label} ${t('FILTER.OPERATOR')}`}
        autoFocus={autoFocus}
      />
      {!isNoInput && (
        <div className="flex-1 min-w-0">
          <Input
            size="sm"
            hideLabel
            label={label}
            type="number"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={handleTextCommit}
            onKeyDown={handleKeyDown}
            placeholder={label}
            aria-label={t('FILTER.VALUE_FOR', { param0: label })}
          />
        </div>
      )}
      {isNoInput && (
        <span className="text-xs text-gray-400 italic px-1" role="status">
          {operators.find((o) => o.value === operator)?.label}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Checkbox variant
// ───────────────────────────────────────────────────────────

function NumberCheckboxFilter({
  field,
  label,
  value,
  onChange,
}: Pick<NumberFilterProps, 'field' | 'label' | 'value' | 'onChange'>) {
  const isChecked = value?.$eq === 1;
  return (
    <div className="wcdv-filter wcdv-filter-number-checkbox flex items-center">
      <Checkbox
        size="sm"
        label={label}
        checked={isChecked}
        onChange={(e) => {
          const checked = (e.target as HTMLInputElement).checked;
          onChange(field, checked ? { $eq: 1 } : null);
        }}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// TriBool variant (True / False / Both)
// ───────────────────────────────────────────────────────────

function NumberTriBoolFilter({
  field,
  label,
  value,
  onChange,
}: Pick<NumberFilterProps, 'field' | 'label' | 'value' | 'onChange'>) {
  const { t } = useTranslation();
  const current =
    value?.$eq === 1 ? 'true' : value?.$eq === 0 ? 'false' : 'both';

  return (
    <div className="wcdv-filter wcdv-filter-number-tribool flex items-center">
      <RadioGroup
        size="sm"
        orientation="horizontal"
        value={current}
        onValueChange={(val: string) => {
          if (val === 'true') onChange(field, { $eq: 1 });
          else if (val === 'false') onChange(field, { $eq: 0 });
          else onChange(field, null);
        }}
        label={label}
      >
        <Radio value="true" label={t('FILTER.TRUE') || 'True'} />
        <Radio value="false" label={t('FILTER.FALSE') || 'False'} />
        <Radio value="both" label={t('FILTER.BOTH') || 'Both'} />
      </RadioGroup>
    </div>
  );
}
