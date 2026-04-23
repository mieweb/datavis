/**
 * FilterBar — composite component replacing GridFilterSet.
 *
 * Renders one filter widget per visible column, collects specs from each,
 * and calls `onFilterChange(spec)` with the combined filter spec that
 * can be passed to `view.setFilter()`.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Dropdown, DropdownContent } from '@mieweb/ui/components/Dropdown';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation } from 'react-i18next';
import { CloseGlyphIcon, IconButton, MenuAction } from '../ui';
import { StringFilter } from './StringFilter';
import { NumberFilter } from './NumberFilter';
import { DateFilter } from './DateFilter';
import { BooleanFilter } from './BooleanFilter';
import type {
  ColumnFilterConfig,
  FieldFilterSpec,
  FilterSpec,
} from './types';
import { COLUMN_DRAG_MIME } from '../controls/column-drag';

export interface FilterFieldOption {
  /** Field name */
  field: string;
  /** Display name */
  displayName: string;
}

export interface FilterBarProps {
  /** Column configurations for the filters to show */
  columns: ColumnFilterConfig[];
  /** Initial / restored filter spec (e.g. from prefs) */
  initialSpec?: FilterSpec;
  /** Raw row data for deriving unique filter options */
  rowData?: unknown[];
  /** Called when any filter changes; receives full combined spec */
  onFilterChange: (spec: FilterSpec) => void;
  /** Called when the user removes a filter column via its remove button */
  onRemoveColumn?: (field: string) => void;
  /** All available fields that can be added as filters */
  availableFields?: FilterFieldOption[];
  /** Called when user picks a field from the "Add field" dropdown */
  onAddColumn?: (field: string) => void;
}

export function FilterBar({
  columns,
  initialSpec,
  rowData,
  onFilterChange,
  onRemoveColumn,
  availableFields = [],
  onAddColumn,
}: FilterBarProps) {
  const { t } = useTranslation();
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

  // Accumulate unique values per string field from rowData (for $in/$nin dropdowns).
  // Uses a ref so that options only grow — filtering down the data won't remove
  // previously-seen values from the dropdown, matching the behavior of columns
  // with explicit `options`.
  const accumulatedOptionsRef = useRef<Record<string, Set<string>>>({});

  const derivedOptions = useMemo(() => {
    if (!rowData?.length) return {};
    const accumulated = accumulatedOptionsRef.current;
    for (const col of visibleColumns) {
      if ((col.filterType === 'string') && !col.options?.length) {
        if (!accumulated[col.field]) accumulated[col.field] = new Set();
        const fieldSet = accumulated[col.field];
        for (const row of rowData) {
          const val = (row as Record<string, unknown>)?.[col.field];
          if (val != null && val !== '') fieldSet.add(String(val));
        }
      }
    }
    const result: Record<string, string[]> = {};
    for (const [field, valSet] of Object.entries(accumulated)) {
      if (valSet.size > 0) {
        result[field] = Array.from(valSet).sort();
      }
    }
    return result;
  }, [rowData, visibleColumns]);

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

  // Fields not yet in the filter bar, available for adding
  const addableFields = useMemo(() => {
    const currentFields = new Set(columns.map((c) => c.field));
    return availableFields.filter((f) => !currentFields.has(f.field));
  }, [availableFields, columns]);

  // "Add field" dropdown open state
  const [addOpen, setAddOpen] = useState(false);
  // Track which field was just added so we can auto-focus its operator select
  const [pendingFocusField, setPendingFocusField] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Clear pending focus after the newly-added filter has mounted
  useEffect(() => {
    if (!pendingFocusField) return;
    const timer = setTimeout(() => setPendingFocusField(null), 100);
    return () => clearTimeout(timer);
  }, [pendingFocusField]);

  const handleNativeDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(COLUMN_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    },
    [],
  );

  const handleNativeDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleNativeDrop = useCallback(
    (e: React.DragEvent) => {
      setDragOver(false);
      const field = e.dataTransfer.getData(COLUMN_DRAG_MIME);
      if (!field) return;
      e.preventDefault();
      // Skip if already has a filter for this field
      const currentFields = new Set(columns.map((c) => c.field));
      if (currentFields.has(field)) return;
      onAddColumn?.(field);
    },
    [columns, onAddColumn],
  );

  if (visibleColumns.length === 0 && addableFields.length === 0) return null;

  return (
    <div
      className={`wcdv-filter-bar border-b border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-2 py-1.5 rounded transition-colors ${
        dragOver ? 'ring-2 ring-blue-400 dark:ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      role="toolbar"
      aria-label={t('FILTER.TOOLBAR') || 'Filters'}
      data-drop-zone="filter"
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
          {t('FILTER.TITLE') || 'Filters'}
          {activeCount > 0 && (
            <span className="ml-1 text-blue-600 dark:text-blue-400">({activeCount})</span>
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
              <CloseGlyphIcon className="h-4 w-4" />
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
            <div className="flex items-center justify-between gap-1">
              <label className="text-[10px] font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wide truncate">
                {col.displayName}
              </label>
              {onRemoveColumn && (
                <IconButton
                  type="button"
                  variant="ghost"
                  className="wcdv-filter-remove h-4 w-4 shrink-0 rounded-full text-[10px] leading-none text-gray-400 dark:text-neutral-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400"
                  onClick={() => {
                    handleFieldChange(col.field, null);
                    onRemoveColumn(col.field);
                  }}
                  aria-label={`${t('FILTER.REMOVE') || 'Remove filter'}: ${col.displayName}`}
                  title={t('FILTER.REMOVE') || 'Remove filter'}
                >
                  <CloseGlyphIcon className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </div>
            <FilterWidget
              column={col}
              derivedOptions={derivedOptions[col.field]}
              value={specs[col.field] ?? undefined}
              onChange={handleFieldChange}
              autoFocusOperator={pendingFocusField === col.field}
            />
          </div>
        ))}

        {/* Add field button */}
        {onAddColumn && addableFields.length > 0 && (
          <div className="wcdv-filter-add relative flex items-end">
            <Dropdown
              open={addOpen}
              onOpenChange={setAddOpen}
              placement="bottom-start"
              width="trigger"
              searchable
              searchPlaceholder={t('FILTER.SEARCH', { defaultValue: 'Search…' })}
              searchAriaLabel={t('FILTER.SEARCH_FIELDS', { defaultValue: 'Search fields' })}
              searchEmptyState={(
                <div className="px-3 py-2 text-xs italic text-gray-400">
                  {t('FILTER.NO_FIELDS', { defaultValue: 'No fields found' })}
                </div>
              )}
              trigger={(
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-[30px] w-full justify-start gap-1 border-dashed text-xs text-gray-500 dark:text-neutral-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400"
                  aria-label={t('FILTER.ADD_FIELD') || 'Add filter field'}
                >
                  <span className="text-sm leading-none">+</span>
                  <span className="truncate">{t('FILTER.ADD_FIELD') || 'Add field…'}</span>
                </Button>
              )}
            >
              <DropdownContent className="max-h-60 overflow-auto py-1">
                {addableFields.map((f) => (
                  <MenuAction
                    key={f.field}
                    searchText={`${f.displayName} ${f.field}`}
                    onClick={() => {
                      setPendingFocusField(f.field);
                      onAddColumn(f.field);
                      setAddOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{f.displayName}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                        {f.field}
                      </span>
                    </span>
                  </MenuAction>
                ))}
              </DropdownContent>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// FilterWidget — dispatches to correct filter by type
// ───────────────────────────────────────────────────────────

interface FilterWidgetProps {
  column: ColumnFilterConfig;
  derivedOptions?: string[];
  value?: FieldFilterSpec;
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
  autoFocusOperator?: boolean;
}

function FilterWidget({ column, derivedOptions, value, onChange, autoFocusOperator }: FilterWidgetProps) {
  const { field, displayName, filterType, widget, options, includeOperators, excludeOperators } = column;
  const effectiveOptions = options?.length ? options : derivedOptions;

  switch (filterType) {
    case 'string':
      return (
        <StringFilter
          field={field}
          label={displayName}
          widget={widget as 'textbox' | 'dropdown' | undefined}
          options={effectiveOptions}
          includeOperators={includeOperators}
          excludeOperators={excludeOperators}
          value={value}
          onChange={onChange}
          autoFocusOperator={autoFocusOperator}
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
          autoFocusOperator={autoFocusOperator}
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
          autoFocusOperator={autoFocusOperator}
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
          autoFocusOperator={autoFocusOperator}
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
          autoFocusOperator={autoFocusOperator}
        />
      );
  }
}
