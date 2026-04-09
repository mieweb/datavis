/**
 * DateFilter — filter component for date and datetime columns.
 *
 * Uses the MIE DateInput for date entry while preserving the
 * engine's canonical date and datetime filter formats.
 *
 * Operators: On, Between, Before, After, Every, Current, Last
 */

import { useState, useCallback, useRef } from 'react';
import { DateInput } from '@mieweb/ui/components/DateInput';
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
  autoFocusOperator?: boolean;
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

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DISPLAY_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function extractIsoDate(value: unknown): string {
  if (typeof value !== 'string') return '';

  const isoMatch = value.match(ISO_DATE_RE);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const displayMatch = value.match(DISPLAY_DATE_RE);
  if (displayMatch) {
    const [, month, day, year] = displayMatch;
    return `${year}-${month}-${day}`;
  }

  return '';
}

function toDisplayDate(value: unknown): string {
  const isoDate = extractIsoDate(value);
  if (!isoDate) return '';

  const [, year, month, day] = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return year && month && day ? `${month}/${day}/${year}` : '';
}

function toDateTimeStart(value: string): string {
  return `${value} 00:00:00`;
}

function toDateTimeEnd(value: string): string {
  return `${value} 23:59:59`;
}

function deferChange(callback: () => void): void {
  requestAnimationFrame(callback);
}

function isStartOfDay(value: string): boolean {
  return /(?:T| )00:00(?::00)?$/.test(value);
}

function isEndOfDay(value: string): boolean {
  return /(?:T| )23:59(?::59)?$/.test(value);
}

function resolveInitialDateState(
  value: FieldFilterSpec | undefined,
  fallbackOperator: FilterOperator,
  includeTime: boolean,
): {
  operator: FilterOperator;
  dateValue: string;
  rangeStart: string;
  rangeEnd: string;
  everyUnit: EveryUnit;
  everyValue: string;
  periodUnit: PeriodUnit;
} {
  const every = value?.$every as { unit?: EveryUnit; value?: string } | undefined;

  if (typeof value?.$eq === 'string') {
    return {
      operator: '$eq',
      dateValue: toDisplayDate(value.$eq),
      rangeStart: '',
      rangeEnd: '',
      everyUnit: every?.unit ?? 'day',
      everyValue: every?.value ?? '',
      periodUnit: typeof value?.$this === 'string' ? (value.$this as PeriodUnit) : 'month',
    };
  }

  if (typeof value?.$bet === 'object' && value.$bet != null) {
    const between = value.$bet as { start?: string; end?: string };
    return {
      operator: '$bet',
      dateValue: '',
      rangeStart: toDisplayDate(between.start),
      rangeEnd: toDisplayDate(between.end),
      everyUnit: every?.unit ?? 'day',
      everyValue: every?.value ?? '',
      periodUnit: typeof value?.$this === 'string' ? (value.$this as PeriodUnit) : 'month',
    };
  }

  const gte = typeof value?.$gte === 'string' ? value.$gte : undefined;
  const lte = typeof value?.$lte === 'string' ? value.$lte : undefined;
  if (gte && lte) {
    const start = toDisplayDate(gte);
    const end = toDisplayDate(lte);
    const operator = includeTime && extractIsoDate(gte) === extractIsoDate(lte) && isStartOfDay(gte) && isEndOfDay(lte)
      ? '$eq'
      : '$bet';

    return {
      operator,
      dateValue: operator === '$eq' ? start : '',
      rangeStart: operator === '$bet' ? start : '',
      rangeEnd: operator === '$bet' ? end : '',
      everyUnit: every?.unit ?? 'day',
      everyValue: every?.value ?? '',
      periodUnit: typeof value?.$this === 'string' ? (value.$this as PeriodUnit) : 'month',
    };
  }

  if (gte) {
    return {
      operator: '$gte',
      dateValue: toDisplayDate(gte),
      rangeStart: '',
      rangeEnd: '',
      everyUnit: every?.unit ?? 'day',
      everyValue: every?.value ?? '',
      periodUnit: typeof value?.$this === 'string' ? (value.$this as PeriodUnit) : 'month',
    };
  }

  if (lte) {
    return {
      operator: '$lte',
      dateValue: toDisplayDate(lte),
      rangeStart: '',
      rangeEnd: '',
      everyUnit: every?.unit ?? 'day',
      everyValue: every?.value ?? '',
      periodUnit: typeof value?.$this === 'string' ? (value.$this as PeriodUnit) : 'month',
    };
  }

  return {
    operator: typeof value?.$this === 'string'
      ? '$this'
      : typeof value?.$last === 'string'
        ? '$last'
        : typeof value?.$every === 'object' && value.$every != null
          ? '$every'
          : fallbackOperator,
    dateValue: '',
    rangeStart: '',
    rangeEnd: '',
    everyUnit: every?.unit ?? 'day',
    everyValue: every?.value ?? '',
    periodUnit:
      typeof value?.$this === 'string'
        ? (value.$this as PeriodUnit)
        : typeof value?.$last === 'string'
          ? (value.$last as PeriodUnit)
          : 'month',
  };
}

export function DateFilter({
  field,
  label,
  includeTime = false,
  includeOperators,
  excludeOperators,
  value,
  onChange,
  autoFocusOperator,
}: DateFilterProps) {
  const { t } = useTranslation();
  const operators = DATE_OPERATORS.filter((op) => {
    if (includeOperators?.length) return includeOperators.includes(op.value);
    if (excludeOperators?.length) return !excludeOperators.includes(op.value);
    return true;
  });

  const fallbackOperator = operators[0]?.value ?? '$eq';
  const initialState = resolveInitialDateState(value, fallbackOperator, includeTime);

  const [operator, setOperator] = useState<FilterOperator>(initialState.operator);

  // For single date value ($eq, $lte, $gte)
  const [dateValue, setDateValue] = useState(initialState.dateValue);

  // For $bet (between) — {start, end}
  const [rangeStart, setRangeStart] = useState(initialState.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(initialState.rangeEnd);

  // For $every — { unit, value }
  const [everyUnit, setEveryUnit] = useState<EveryUnit>(initialState.everyUnit);
  const [everyValue, setEveryValue] = useState(initialState.everyValue);

  // For $this / $last — period unit
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>(initialState.periodUnit);

  const isNoInput = operators.find((o) => o.value === operator)?.noInput;

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
          if (!opts.date) {
            onChange(field, null);
          } else if (includeTime) {
            if (op === '$eq') {
              onChange(field, {
                $gte: toDateTimeStart(opts.date),
                $lte: toDateTimeEnd(opts.date),
              });
            } else if (op === '$gte') {
              onChange(field, { $gte: toDateTimeStart(opts.date) });
            } else {
              onChange(field, { $lte: toDateTimeEnd(opts.date) });
            }
          } else {
            onChange(field, { [op]: opts.date });
          }
          break;

        case '$bet':
          if (!opts.start && !opts.end) {
            onChange(field, null);
          } else {
            const nextSpec: FieldFilterSpec = {};
            if (opts.start) {
              nextSpec.$gte = includeTime ? toDateTimeStart(opts.start) : opts.start;
            }
            if (opts.end) {
              nextSpec.$lte = includeTime ? toDateTimeEnd(opts.end) : opts.end;
            }
            onChange(field, Object.keys(nextSpec).length > 0 ? nextSpec : null);
          }
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
        autoFocusOnMount={autoFocusOperator}
      />

      {/* Single date: On / Before / After */}
      {(operator === '$eq' || operator === '$lte' || operator === '$gte') && (
        <DateInput
          size="sm"
          hideLabel
          label={t('FILTER.DATE_VALUE', { param0: label })}
          mode={includeTime ? 'default' : 'default'}
          className="min-w-0 flex-1"
          value={dateValue}
          onChange={(nextValue) => {
            setDateValue(nextValue);
            deferChange(() => {
              emitChange(operator, { date: extractIsoDate(nextValue) });
            });
          }}
          aria-label={t('FILTER.DATE_VALUE', { param0: label })}
        />
      )}

      {/* Between: two date inputs */}
      {operator === '$bet' && (
        <>
          <DateInput
            size="sm"
            hideLabel
            label={`${label} ${t('FILTER.DATE_FROM') || 'from'}`}
            value={rangeStart}
            onChange={(nextValue) => {
              const nextStart = extractIsoDate(nextValue);
              setRangeStart(nextValue);
              deferChange(() => {
                emitChange(operator, { start: nextStart, end: extractIsoDate(rangeEnd) });
              });
              if (nextStart && endDateRef.current) {
                requestAnimationFrame(() => {
                  endDateRef.current?.focus();
                });
              }
            }}
            aria-label={`${label} ${t('FILTER.DATE_FROM') || 'from'}`}
          />
          <span className="text-xs text-gray-400 dark:text-neutral-500">–</span>
          <DateInput
            size="sm"
            hideLabel
            label={`${label} ${t('FILTER.DATE_TO') || 'to'}`}
            ref={endDateRef}
            value={rangeEnd}
            onChange={(nextValue) => {
              setRangeEnd(nextValue);
              deferChange(() => {
                emitChange(operator, { start: extractIsoDate(rangeStart), end: extractIsoDate(nextValue) });
              });
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
        <span className="text-xs text-gray-400 dark:text-neutral-500 italic px-1" role="status">
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
