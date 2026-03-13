/**
 * DateFilter — filter component for date and datetime columns.
 *
 * Replaces the legacy flatpickr-based filters with native date inputs
 * and the "neon" operator-based date filter UI.
 *
 * Operators: On, Between, Before, After, Every, Current, Last
 */

import { useState, useCallback, useRef } from 'react';
import { Select } from '@mieweb/ui/components/Select';
import { useTranslation } from 'react-i18next';
import { FilterOperatorSelect } from './FilterOperatorSelect';
import {
  DATE_OPERATORS,
  type FilterOperator,
  type FieldFilterSpec,
  type EveryUnit,
  type PeriodUnit,
} from './types';

export interface DateFilterProps {
  /** Field name */
  field: string;
  /** Display label */
  label: string;
  /** Whether this is a datetime (includes time) or date-only */
  includeTime?: boolean;
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

/** Period options for $this / $last operators */
const PERIOD_OPTIONS: { value: PeriodUnit; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

/** Every options for $every operator */
const EVERY_OPTIONS: { value: EveryUnit; label: string }[] = [
  { value: 'day', label: 'Day of week' },
  { value: 'month', label: 'Month' },
];

export function DateFilter({
  field,
  label,
  includeTime = false,
  includeOperators,
  excludeOperators,
  value,
  onChange,
  autoFocus,
}: DateFilterProps) {
  const { t } = useTranslation();
  const operators = DATE_OPERATORS.filter((op) => {
    if (includeOperators?.length) return includeOperators.includes(op.value);
    if (excludeOperators?.length) return !excludeOperators.includes(op.value);
    return true;
  });

  const initialOp = value
    ? (Object.keys(value)[0] as FilterOperator)
    : operators[0]?.value ?? '$eq';
  const initialVal = value?.[initialOp];

  const [operator, setOperator] = useState<FilterOperator>(initialOp);

  // For single date value ($eq, $lte, $gte)
  const [dateValue, setDateValue] = useState(
    typeof initialVal === 'string' ? initialVal : '',
  );

  // For $bet (between) — {start, end}
  const [rangeStart, setRangeStart] = useState(
    (initialVal as { start?: string })?.start ?? '',
  );
  const [rangeEnd, setRangeEnd] = useState(
    (initialVal as { end?: string })?.end ?? '',
  );

  // For $every — { unit, value }
  const [everyUnit, setEveryUnit] = useState<EveryUnit>(
    (initialVal as { unit?: EveryUnit })?.unit ?? 'day',
  );
  const [everyValue, setEveryValue] = useState(
    (initialVal as { value?: string })?.value ?? '',
  );

  // For $this / $last — period unit
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>(
    typeof initialVal === 'string' ? (initialVal as PeriodUnit) : 'month',
  );

  const isNoInput = operators.find((o) => o.value === operator)?.noInput;
  const inputType = includeTime ? 'datetime-local' : 'date';

  // Ref for the "end" date input in Between mode
  const endDateRef = useRef<HTMLInputElement>(null);

  const emitChange = useCallback(
    (
      op: FilterOperator,
      opts: {
        date?: string;
        start?: string;
        end?: string;
        evUnit?: EveryUnit;
        evValue?: string;
        period?: PeriodUnit;
      },
    ) => {
      const info = operators.find((o) => o.value === op);
      if (info?.noInput) {
        onChange(field, { [op]: true });
        return;
      }

      switch (op) {
        case '$eq':
        case '$lte':
        case '$gte':
          if (!opts.date) onChange(field, null);
          else onChange(field, { [op]: opts.date });
          break;

        case '$bet':
          if (!opts.start && !opts.end) onChange(field, null);
          else onChange(field, { $bet: { start: opts.start, end: opts.end } });
          break;

        case '$every':
          if (!opts.evValue) onChange(field, null);
          else
            onChange(field, {
              $every: { unit: opts.evUnit, value: opts.evValue },
            });
          break;

        case '$this':
        case '$last':
          onChange(field, { [op]: opts.period });
          break;

        default:
          onChange(field, null);
      }
    },
    [field, onChange, operators],
  );

  const handleOperatorChange = useCallback(
    (op: FilterOperator) => {
      setOperator(op);
      // Emit with current relevant values
      emitChange(op, {
        date: dateValue,
        start: rangeStart,
        end: rangeEnd,
        evUnit: everyUnit,
        evValue: everyValue,
        period: periodUnit,
      });
    },
    [dateValue, rangeStart, rangeEnd, everyUnit, everyValue, periodUnit, emitChange],
  );

  return (
    <div className="wcdv-filter wcdv-filter-date flex items-center gap-1 flex-wrap">
      <FilterOperatorSelect
        operators={operators}
        value={operator}
        onChange={handleOperatorChange}
        aria-label={`${label} ${t('FILTER.OPERATOR')}`}
        autoFocus={autoFocus}
      />

      {/* Single date: On / Before / After */}
      {(operator === '$eq' || operator === '$lte' || operator === '$gte') && (
        <input
          type={inputType}
          className="flex-1 min-w-0 h-7 rounded border border-gray-300 bg-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={dateValue}
          onChange={(e) => {
            setDateValue(e.target.value);
            emitChange(operator, { date: e.target.value });
          }}
          aria-label={t('FILTER.DATE_VALUE', { param0: label })}
        />
      )}

      {/* Between: two date inputs */}
      {operator === '$bet' && (
        <>
          <input
            type={inputType}
            className="h-7 rounded border border-gray-300 bg-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={rangeStart}
            onChange={(e) => {
              setRangeStart(e.target.value);
              emitChange(operator, { start: e.target.value, end: rangeEnd });
              // Auto-focus end date only when a complete, valid date is entered.
              // Browser fires onChange with year=0001 while user is still typing
              // month/day segments, so require year >= 1000 to be sure.
              const input = e.target;
              const year = input.valueAsDate?.getFullYear() ?? 0;
              if (input.value && input.validity.valid && !isNaN(input.valueAsNumber) && year >= 1000 && endDateRef.current) {
                requestAnimationFrame(() => {
                  endDateRef.current?.focus();
                });
              }
            }}
            aria-label={`${label} ${t('FILTER.DATE_FROM') || 'from'}`}
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            ref={endDateRef}
            type={inputType}
            className="h-7 rounded border border-gray-300 bg-white text-xs px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={rangeEnd}
            onChange={(e) => {
              setRangeEnd(e.target.value);
              emitChange(operator, { start: rangeStart, end: e.target.value });
            }}
            aria-label={`${label} ${t('FILTER.DATE_TO') || 'to'}`}
          />
        </>
      )}

      {/* Every: unit selector + value */}
      {operator === '$every' && (
        <>
          <Select
            size="sm"
            hideLabel
            label={t('FILTER.EVERY_UNIT') || 'Period'}
            options={EVERY_OPTIONS.map((o) => ({
              value: o.value,
              label: t(`FILTER.EVERY_${o.value.toUpperCase()}`) || o.label,
            }))}
            value={everyUnit}
            onValueChange={(val) => {
              const unit = val as EveryUnit;
              setEveryUnit(unit);
              emitChange(operator, { evUnit: unit, evValue: everyValue });
            }}
          />
          <DayOrMonthSelect
            unit={everyUnit}
            value={everyValue}
            onChange={(val) => {
              setEveryValue(val);
              emitChange(operator, { evUnit: everyUnit, evValue: val });
            }}
          />
        </>
      )}

      {/* Current / Last: period unit */}
      {(operator === '$this' || operator === '$last') && (
        <Select
          size="sm"
          hideLabel
          label={t('FILTER.PERIOD') || 'Period'}
          options={PERIOD_OPTIONS.map((o) => ({
            value: o.value,
            label: t(`FILTER.PERIOD_${o.value.toUpperCase()}`) || o.label,
          }))}
          value={periodUnit}
          onValueChange={(val) => {
            const period = val as PeriodUnit;
            setPeriodUnit(period);
            emitChange(operator, { period });
          }}
        />
      )}

      {/* No-input operators ($exists / $notexists) */}
      {isNoInput && (
        <span className="text-xs text-gray-400 italic px-1" role="status">
          {t(operators.find((o) => o.value === operator)?.label ?? '')}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Day-of-week or Month selector for $every
// ───────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function DayOrMonthSelect({
  unit,
  value,
  onChange,
}: {
  unit: EveryUnit;
  value: string;
  onChange: (val: string) => void;
}) {
  const { t } = useTranslation();
  const items = unit === 'day' ? DAYS_OF_WEEK : MONTHS;
  return (
    <Select
      size="sm"
      hideLabel
      label={unit === 'day' ? t('FILTER.DAY_OF_WEEK') || 'Day' : t('FILTER.MONTH') || 'Month'}
      placeholder={unit === 'day' ? 'Day…' : 'Month…'}
      options={items.map((item, i) => ({
        value: String(i),
        label: t(`FILTER.${unit.toUpperCase()}_${i}`) || item,
      }))}
      value={value}
      onValueChange={onChange}
    />
  );
}
