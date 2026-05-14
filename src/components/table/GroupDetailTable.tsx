/**
 * GroupDetailTable — React table renderer for group-detail mode.
 *
 * Replaces the legacy `GridTableGroupDetail` (1419 lines of jQuery DOM).
 * Shows data rows grouped by field values, with collapsible group headers
 * showing aggregate values.
 */

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Button } from '@mieweb/ui/components/Button';

import type {
  BaseTableProps,
  TableColumn,
  TableRow,
  GroupMeta,
  SortDirection,
  SelectionState,
} from './types';
import { useIsConstrained, useViewportSticky } from './useAutoHeight';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../i18n';
import { ClipboardIcon, DisclosureGlyphIcon, IconButton, SortGlyphIcon, TableActionButton } from '../ui';
import { formatCellValue, formatAggregateNumber, getAggregateValueForField } from './format-cell';

/**
 * Parse aggregate keys like "sum(salary)" into a map of field → [{fn, value}].
 * Keys without parentheses (e.g. "count") are mapped under the empty string.
 */
function buildAggByField(
  aggregates?: Record<string, unknown>,
): Record<string, { fn: string; value: unknown }[]> {
  if (!aggregates) return {};
  const map: Record<string, { fn: string; value: unknown }[]> = {};
  for (const [key, val] of Object.entries(aggregates)) {
    const m = key.match(/^(\w+)\((\w+)\)$/);
    const field = m ? m[2] : '';
    const fn = m ? m[1] : key;
    if (!map[field]) map[field] = [];
    map[field].push({ fn, value: val });
  }
  return map;
}

/**
 * Describes the column layout: which logical columns expand into sub-columns
 * for aggregate functions.  A column with no aggregates gets `aggFns: []`
 * and span = 1.
 */
interface ColumnLayout {
  field: string;
  header: string;
  width?: number;
  minWidth?: number;
  className?: string;
  /** Column type info for formatting */
  typeInfo?: TableColumn['typeInfo'];
  /** Aggregate function names assigned to this column (e.g. ["sum","avg"]) */
  aggFns: string[];
  /** Total number of physical sub-columns (max(1, aggFns.length)) */
  span: number;
}

/**
 * Merge group metadata from all groups to discover every active aggregate
 * function per field.  Returns a stable map of field → ordered fn names.
 */
function deriveAggLayout(
  groups: Record<string, GroupMeta>,
): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  for (const meta of Object.values(groups)) {
    if (!meta.aggregates) continue;
    for (const key of Object.keys(meta.aggregates)) {
      const m = key.match(/^(\w+)\((\w+)\)$/);
      const field = m ? m[2] : '';
      const fn = m ? m[1] : key;
      if (!map[field]) map[field] = new Set();
      map[field].add(fn);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [field, fns] of Object.entries(map)) {
    result[field] = [...fns];
  }
  return result;
}

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface GroupDetailTableProps extends BaseTableProps {
  /** Group metadata keyed by group key string */
  groups: Record<string, GroupMeta>;
  /** Rows organized by group key */
  groupedRows: Record<string, TableRow[]>;
  /** Ordered group keys */
  groupOrder: string[];
  /** Fields used for grouping */
  groupFields: string[];
  /** Whether to show a total row at the bottom */
  showTotalRow?: boolean;
  /** Whether to start with groups expanded */
  initialExpanded?: boolean;
  /** Whether to pin row-values columns */
  pinRowvals?: boolean;
  /** Total-row aggregate values */
  totalAggregates?: Record<string, unknown>;
  /** Map of aggregate function internal names to display labels (e.g. { list: 'Unique Values' }) */
  aggFnLabels?: Record<string, string>;
  /** Callback when a group is expanded/collapsed */
  onGroupToggle?: (groupKey: string, expanded: boolean) => void;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function GroupDetailTable({
  columns,
  groups,
  groupedRows,
  groupOrder,
  groupFields,
  sort,
  features = {},
  totalRows,
  limit,
  formatCell,
  showTotalRow = false,
  initialExpanded = true,
  totalAggregates,
  aggFnLabels,
  onSort,
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  onShowMore,
  onShowAll,
  className = '',
}: GroupDetailTableProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  // Track expanded state per group
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (initialExpanded) return new Set(groupOrder);
    return new Set();
  });

  useEffect(() => {
    setExpandedGroups(initialExpanded ? new Set(groupOrder) : new Set());
  }, [groupOrder, initialExpanded]);

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
    },
    [],
  );

  const allExpanded = groupOrder.length > 0 && groupOrder.every((k) => expandedGroups.has(k));

  const toggleAll = useCallback(() => {
    setExpandedGroups((prev) => {
      if (groupOrder.every((k) => prev.has(k))) return new Set();
      return new Set(groupOrder);
    });
  }, [groupOrder]);

  // Non-group columns (for detail rows)
  const dataColumns = useMemo(
    () => columns.filter((c) => !groupFields.includes(c.field)),
    [columns, groupFields],
  );

  // Derive aggregate layout from all groups
  const aggLayout = useMemo(() => deriveAggLayout(groups), [groups]);
  const hasAggSubCols = Object.keys(aggLayout).length > 0;

  // Build column layout: expand columns with aggregates into sub-columns
  const columnLayout: ColumnLayout[] = useMemo(
    () =>
      dataColumns
        .filter((c) => c.visible !== false)
        .map((col) => {
          const fns = aggLayout[col.field] ?? [];
          return {
            field: col.field,
            header: col.header,
            width: col.width,
            minWidth: col.minWidth,
            className: col.className,
            typeInfo: col.typeInfo,
            aggFns: fns,
            span: Math.max(1, fns.length),
          };
        }),
    [dataColumns, aggLayout],
  );

  // Format group header label
  const formatGroupLabel = useCallback(
    (_groupKey: string, meta: GroupMeta): string => {
      const parts = groupFields.map((field) => {
        const val = meta.groupValues[field];
        return `${field}: ${val ?? '(empty)'}`;
      });
      return parts.join(' / ');
    },
    [groupFields],
  );

  // Format a single aggregate value for display in a column cell
  const formatAggValue = useCallback(
    (fn: string, value: unknown): ReactNode => {
      if (value == null) return '';
      const display = formatAggregateNumber(value, locale);
      return (
        <span className="wcdv-agg-value">
          <span className="text-gray-400 dark:text-neutral-500 uppercase">{fn}</span>{' '}
          <span className="font-semibold">{display}</span>
        </span>
      );
    },
    [locale],
  );

  const handleSort = useCallback(
    (field: string, direction: SortDirection) => {
      onSort?.(field, direction);
    },
    [onSort],
  );

  const [containerScrolled, setContainerScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConstrained = useIsConstrained(scrollRef);
  useViewportSticky(scrollRef, isConstrained, features.stickyHeaders !== false);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setContainerScrolled(el.scrollTop > 0);
  }, []);

  return (
    <div
      className={`wcdv-group-detail-table flex flex-col flex-1 min-h-0 ${className}`}
    >
      <div ref={scrollRef} className={`flex-1 min-h-0 overflow-x-auto${isConstrained ? ' overflow-y-auto' : ''}`} onScroll={handleScroll}>
        <table className="w-full border-collapse" role="treegrid" aria-colcount={columnLayout.reduce((sum, col) => sum + col.span, 0) + 1} aria-rowcount={totalRows ?? 0}>
          <caption className="sr-only">{t('TABLE.CAPTION', { param0: t('GRID_TOOLBAR.GROUP.MODE.DETAIL') }) || 'Data table: Detail'}</caption>
          {/* Header */}
          <thead
            className={
              features.stickyHeaders !== false
                ? `${isConstrained ? 'sticky top-0' : ''} z-10 bg-gray-50 dark:bg-neutral-800${isConstrained && containerScrolled ? ' wcdv-thead-shadow' : ''}`
                : ''
            }
          >
            {/* Row 1: column names (with colSpan for agg sub-columns) */}
            <tr>
              {/* Expand/collapse all groups */}
              <th
                className="wcdv-group-toggle-all w-8 border-b border-r border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-1 py-2 text-center"
                rowSpan={hasAggSubCols ? 2 : 1}
                scope="col"
              >
                <IconButton
                  type="button"
                  variant="ghost"
                  className="h-5 w-5 text-gray-500 dark:text-neutral-400 shadow-none hover:bg-transparent hover:text-gray-800 dark:hover:text-neutral-200"
                  onClick={toggleAll}
                  aria-label={t('TABLE.TOGGLE_ALL_GROUPS') || (allExpanded ? 'Collapse all groups' : 'Expand all groups')}
                >
                  <DisclosureGlyphIcon className="h-4 w-4" expanded={allExpanded} />
                </IconButton>
              </th>
              {columnLayout.map((col) => (
                <th
                  key={col.field}
                  colSpan={col.span}
                  rowSpan={hasAggSubCols && col.aggFns.length === 0 ? 2 : 1}
                  className={`border-b border-r border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-neutral-400 ${
                    col.aggFns.length > 0 ? 'text-center' : ''
                  }`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="columnheader"
                  scope="col"
                  aria-sort={
                    sort?.field === col.field
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={`flex h-auto w-full items-center gap-0.5 bg-transparent p-0 text-left text-inherit font-inherit uppercase tracking-wider shadow-none hover:bg-transparent ${
                      col.aggFns.length > 0 ? 'justify-center' : ''
                    }`}
                    onClick={() =>
                      handleSort(
                        col.field,
                        sort?.field === col.field && sort.direction === 'asc'
                          ? 'desc'
                          : 'asc',
                      )
                    }
                    aria-label={t('TABLE.SORT_BY', { param0: col.header }) || `Sort by ${col.header}`}
                  >
                    <span className="truncate">{col.header}</span>
                    {sort?.field === col.field && (
                      <span className="ml-1 text-blue-500 dark:text-blue-400 text-xs">
                        <SortGlyphIcon className="text-blue-500 dark:text-blue-400" direction={sort.direction} />
                      </span>
                    )}
                  </Button>
                </th>
              ))}
            </tr>

            {/* Row 2: aggregate function sub-headers (only when aggregates active) */}
            {hasAggSubCols && (
              <tr>
                {columnLayout.map((col) => {
                  if (col.aggFns.length === 0) return null; // rowSpan=2 on row 1
                  return col.aggFns.map((fn) => (
                    <th
                      key={`${col.field}-${fn}`}
                      className="border-b border-r border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-neutral-400"
                      scope="col"
                    >
                      {aggFnLabels?.[fn] ? t(aggFnLabels[fn]) : fn}
                    </th>
                  ));
                })}
              </tr>
            )}
          </thead>

          {/* Body: groups + detail rows */}
          <tbody>
            {groupOrder.map((groupKey) => {
              const meta = groups[groupKey];
              const rows = groupedRows[groupKey] ?? [];
              const isExpanded = expandedGroups.has(groupKey);

              return (
                <GroupSection
                  key={groupKey}
                  groupKey={groupKey}
                  meta={meta}
                  rows={rows}
                  expanded={isExpanded}
                  columnLayout={columnLayout}
                  features={features}
                  formatCell={formatCell}
                  formatGroupLabel={formatGroupLabel}
                  formatAggValue={formatAggValue}
                  onToggle={toggleGroup}
                  onRowClick={onRowClick}
                  onRowDoubleClick={onRowDoubleClick}
                  onSelectionChange={onSelectionChange}
                />
              );
            })}

            {/* Total row */}
            {showTotalRow && (
              <tr className="bg-gray-100 dark:bg-neutral-800 font-semibold border-t-2 border-gray-300 dark:border-neutral-600">
                <td className="px-1 py-2 text-center text-xs text-gray-500 dark:text-neutral-400">
                  <ClipboardIcon className="mx-auto h-4 w-4" />
                </td>
                {columnLayout.map((col) => (
                    <td
                      key={col.field}
                      colSpan={col.span}
                      className="border-r border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm"
                    >
                      {(() => {
                        const aggregateValue = getAggregateValueForField(totalAggregates, col.field);
                        return aggregateValue != null ? String(aggregateValue) : '';
                      })()}
                    </td>
                  ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {totalRows != null && (
        <div className="wcdv-table-footer flex items-center justify-between border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-3 py-1.5 text-xs text-gray-500 dark:text-neutral-400">
          <span>
            {groupOrder.length} {t('TABLE.GROUPS') || 'groups'},{' '}
            {totalRows} {t('TABLE.ROWS') || 'rows'}
          </span>
          {limit &&
            totalRows > (limit.limit ?? 0) &&
            Object.values(groupedRows).reduce((s, r) => s + r.length, 0) <
              totalRows && (
              <div className="flex gap-2">
                <TableActionButton
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  onClick={onShowMore}
                >
                  {t('TABLE.SHOW_MORE') || 'Show More'}
                </TableActionButton>
                <TableActionButton
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  onClick={onShowAll}
                >
                  {t('TABLE.SHOW_ALL') || 'Show All'}
                </TableActionButton>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// GroupSection — renders a single group header + its detail rows
// ───────────────────────────────────────────────────────────

interface GroupSectionProps {
  groupKey: string;
  meta: GroupMeta;
  rows: TableRow[];
  expanded: boolean;
  columnLayout: ColumnLayout[];
  features: BaseTableProps['features'];
  formatCell?: BaseTableProps['formatCell'];
  formatGroupLabel: (key: string, meta: GroupMeta) => string;
  formatAggValue: (fn: string, value: unknown) => ReactNode;
  onToggle: (key: string) => void;
  onRowClick?: BaseTableProps['onRowClick'];
  onRowDoubleClick?: BaseTableProps['onRowDoubleClick'];
  onSelectionChange?: (selection: SelectionState) => void;
}

function GroupSection({
  groupKey,
  meta,
  rows,
  expanded,
  columnLayout,
  features,
  formatCell,
  formatGroupLabel,
  formatAggValue,
  onToggle,
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
}: GroupSectionProps) {
  const locale = useLocale();
  const aggByField = useMemo(
    () => buildAggByField(meta.aggregates),
    [meta.aggregates],
  );

  const selectGroupRows = useCallback(
    (activeRow: number | null) => {
      onSelectionChange?.({
        selectedRows: new Set(rows.map((row) => row.rowNum)),
        activeRow,
        activeColumn: null,
      });
    },
    [onSelectionChange, rows],
  );

  return (
    <>
      {/* Group header row — one cell per physical sub-column */}
      <tr
        className="wcdv-group-header bg-gray-100 dark:bg-neutral-800 border-t border-gray-300 dark:border-neutral-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
        role="row"
        aria-expanded={expanded}
        aria-level={meta.level + 1}
        onClick={() => {
          selectGroupRows(rows[0]?.rowNum ?? null);
          onToggle(groupKey);
        }}
      >
        {/* Chevron toggle */}
        <td className="px-1 py-2 text-center text-xs text-gray-500 dark:text-neutral-400">
          <DisclosureGlyphIcon className="mx-auto h-4 w-4" expanded={expanded} />
        </td>
        {/* First column: group label + row count */}
        {columnLayout.length > 0 && (() => {
          const first = columnLayout[0];
          const firstAggs = aggByField[first.field];
          if (first.aggFns.length > 0) {
            // First column has agg sub-columns — label goes in first sub-col
            return first.aggFns.map((fn, fi) => (
              <td
                key={`${first.field}-${fn}`}
                className={`border-r border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm ${
                  fi === 0 ? 'font-semibold text-gray-700 dark:text-neutral-300' : 'text-center text-gray-600 dark:text-neutral-400 text-xs'
                }`}
                style={fi === 0 ? { minWidth: first.minWidth ?? 50 } : undefined}
              >
                {fi === 0 && (
                  <>
                    <span>{formatGroupLabel(groupKey, meta)}</span>
                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-neutral-500">
                      ({meta.count} {meta.count === 1 ? 'row' : 'rows'})
                    </span>
                  </>
                )}
                {firstAggs && (() => {
                  const match = firstAggs.find((a) => a.fn === fn);
                  return match ? formatAggValue(match.fn, match.value) : null;
                })()}
              </td>
            ));
          }
          return (
            <td
              key={first.field}
              className="border-r border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-neutral-300"
              style={{ minWidth: first.minWidth ?? 50 }}
            >
              <span>{formatGroupLabel(groupKey, meta)}</span>
              <span className="ml-2 text-xs font-normal text-gray-400 dark:text-neutral-500">
                ({meta.count} {meta.count === 1 ? 'row' : 'rows'})
              </span>
            </td>
          );
        })()}
        {/* Remaining columns: aggregate values in matching sub-columns */}
        {columnLayout.slice(1).map((col) => {
          const aggs = aggByField[col.field];
          if (col.aggFns.length > 0) {
            return col.aggFns.map((fn) => {
              const match = aggs?.find((a) => a.fn === fn);
              return (
                <td
                  key={`${col.field}-${fn}`}
                  className="border-r border-gray-200 dark:border-neutral-700 px-2 py-2 text-center text-sm text-gray-600 dark:text-neutral-400"
                >
                  {match ? formatAggValue('', match.value) : ''}
                </td>
              );
            });
          }
          return (
            <td
              key={col.field}
              className="border-r border-gray-200 dark:border-neutral-700 px-3 py-2 text-sm"
            />
          );
        })}
      </tr>

      {/* Detail rows — data cells span across sub-columns */}
      {expanded &&
        rows.map((row, rowIdx) => {
          const zebraClass =
            features?.zebraStripe !== false && rowIdx % 2 === 1
              ? 'bg-gray-50/50 dark:bg-neutral-800/50'
              : '';

          return (
            <tr
              key={row.rowId ?? row.rowNum}
              data-row-num={row.rowNum}
              className={`wcdv-tr border-b border-gray-100 dark:border-neutral-700 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/20 ${zebraClass}`}
              role="row"
              aria-level={meta.level + 2}
              onClick={(e) => {
                selectGroupRows(row.rowNum);
                onRowClick?.(row, e);
              }}
              onDoubleClick={
                onRowDoubleClick
                  ? (e) => onRowDoubleClick(row, e)
                  : undefined
              }
            >
              {/* Indent cell */}
              <td className="px-1" />
              {columnLayout.map((col) => (
                <td
                  key={col.field}
                  colSpan={col.span}
                  className={`wcdv-td border-r border-gray-100 dark:border-neutral-700 px-3 py-1.5 text-sm ${col.className ?? ''}`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="gridcell"
                >
                  {formatCell
                    ? formatCell(row.data[col.field], row.data, col as TableColumn)
                    : formatCellValue(row.data[col.field], col.typeInfo, locale)}
                </td>
              ))}
            </tr>
          );
        })}
    </>
  );
}
