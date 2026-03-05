/**
 * FilterBar — composite component replacing GridFilterSet.
 *
 * Renders one filter widget per visible column, collects specs from each,
 * and calls `onFilterChange(spec)` with the combined filter spec that
 * can be passed to `view.setFilter()`.
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { StringFilter } from './StringFilter';
import { NumberFilter } from './NumberFilter';
import { DateFilter } from './DateFilter';
import { BooleanFilter } from './BooleanFilter';
import type {
  ColumnFilterConfig,
  FieldFilterSpec,
  FilterSpec,
} from './types';

export interface FilterBarProps {
  /** Column configurations for the filters to show */
  columns: ColumnFilterConfig[];
  /** Initial / restored filter spec (e.g. from prefs) */
  initialSpec?: FilterSpec;
  /** Called when any filter changes; receives full combined spec */
  onFilterChange: (spec: FilterSpec) => void;
  /** i18n */
  trans?: (key: string) => string;
}

export function FilterBar({
  columns,
  initialSpec,
  onFilterChange,
  trans: t = (k) => k,
}: FilterBarProps) {
  // Track each field's individual spec
  const [specs, setSpecs] = useState<Record<string, FieldFilterSpec | null>>(
    () => {
      if (!initialSpec) return {};
      const result: Record<string, FieldFilterSpec | null> = {};
      for (const col of columns) {
        if (initialSpec[col.field]) result[col.field] = initialSpec[col.field];
      }
      return result;
    },
  );

  // Visible columns only
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns],
  );

  const handleFieldChange = useCallback(
    (field: string, fieldSpec: FieldFilterSpec | null) => {
      setSpecs((prev) => {
        const next = { ...prev, [field]: fieldSpec };

        // Build combined spec (omit null entries)
        const combined: FilterSpec = {};
        for (const [f, s] of Object.entries(next)) {
          if (s) combined[f] = s;
        }
        onFilterChange(combined);

        return next;
      });
    },
    [onFilterChange],
  );

  const clearAll = useCallback(() => {
    setSpecs({});
    onFilterChange({});
  }, [onFilterChange]);

  const activeCount = Object.values(specs).filter(Boolean).length;

  if (visibleColumns.length === 0) return null;

  return (
    <div
      className="wcdv-filter-bar border-b border-gray-200 bg-gray-50 px-2 py-1.5"
      role="toolbar"
      aria-label={t('FILTER.TOOLBAR') || 'Filters'}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">
          {t('FILTER.TITLE') || 'Filters'}
          {activeCount > 0 && (
            <span className="ml-1 text-blue-600">({activeCount})</span>
          )}
        </span>
        {activeCount > 0 && (
          <Tooltip content={t('FILTER.CLEAR_ALL') || 'Clear all filters'}>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearAll}
              aria-label={t('FILTER.CLEAR_ALL') || 'Clear all filters'}
            >
              ✕
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Filter widgets — laid out in a responsive grid */}
      <div className="wcdv-filter-bar-fields grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
        {visibleColumns.map((col) => (
          <div
            key={col.field}
            className="wcdv-filter-cell flex flex-col gap-0.5"
          >
            <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">
              {col.displayName}
            </label>
            <FilterWidget
              column={col}
              value={specs[col.field] ?? undefined}
              onChange={handleFieldChange}
              trans={t}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// FilterWidget — dispatches to correct filter by type
// ───────────────────────────────────────────────────────────

interface FilterWidgetProps {
  column: ColumnFilterConfig;
  value?: FieldFilterSpec;
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
  trans: (key: string) => string;
}

function FilterWidget({ column, value, onChange, trans }: FilterWidgetProps) {
  const { field, displayName, filterType, widget, options, includeOperators, excludeOperators } = column;

  switch (filterType) {
    case 'string':
      return (
        <StringFilter
          field={field}
          label={displayName}
          widget={widget as 'textbox' | 'dropdown' | undefined}
          options={options}
          includeOperators={includeOperators}
          excludeOperators={excludeOperators}
          value={value}
          onChange={onChange}
          trans={trans}
        />
      );

    case 'number':
    case 'currency':
      return (
        <NumberFilter
          field={field}
          label={displayName}
          widget={widget as 'textbox' | 'checkbox' | 'tribool' | undefined}
          includeOperators={includeOperators}
          excludeOperators={excludeOperators}
          value={value}
          onChange={onChange}
          trans={trans}
        />
      );

    case 'date':
      return (
        <DateFilter
          field={field}
          label={displayName}
          includeTime={false}
          includeOperators={includeOperators}
          excludeOperators={excludeOperators}
          value={value}
          onChange={onChange}
          trans={trans}
        />
      );

    case 'datetime':
      return (
        <DateFilter
          field={field}
          label={displayName}
          includeTime={true}
          includeOperators={includeOperators}
          excludeOperators={excludeOperators}
          value={value}
          onChange={onChange}
          trans={trans}
        />
      );

    case 'boolean':
      return (
        <BooleanFilter
          field={field}
          label={displayName}
          value={value}
          onChange={onChange}
        />
      );

    default:
      return (
        <StringFilter
          field={field}
          label={displayName}
          widget="textbox"
          value={value}
          onChange={onChange}
          trans={trans}
        />
      );
  }
}
