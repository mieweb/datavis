/**
 * GroupDetailTable — React table renderer for group-detail mode.
 *
 * Replaces the legacy `GridTableGroupDetail` (1419 lines of jQuery DOM).
 * Shows data rows grouped by field values, with collapsible group headers
 * showing aggregate values.
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';

import type {
  BaseTableProps,
  TableRow,
  GroupMeta,
  SortDirection,
} from './types';
import { useTranslation } from '../../i18n';

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
  trans: transProp,
  showTotalRow = false,
  initialExpanded = true,
  totalAggregates,
  aggFnLabels,
  onSort,
  onRowClick,
  onRowDoubleClick,
  onShowMore,
  onShowAll,
  className = '',
}: GroupDetailTableProps) {
  const t = useTranslation(transProp);
  // Track expanded state per group
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (initialExpanded) return new Set(groupOrder);
    return new Set();
  });

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
      const num = Number(value);
      const display = !isNaN(num) && typeof value !== 'boolean'
        ? num.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : String(value);
      return (
        <span className="wcdv-agg-value">
          <span className="text-gray-400 uppercase">{fn}</span>{' '}
          <span className="font-semibold">{display}</span>
        </span>
      );
    },
    [],
  );

  const handleSort = useCallback(
    (field: string, direction: SortDirection) => {
      onSort?.(field, direction);
    },
    [onSort],
  );

  return (
    <div
      className={`wcdv-group-detail-table flex flex-col h-full ${className}`}
      aria-rowcount={totalRows ?? 0}
    >
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse" role="treegrid">
          {/* Header */}
          <thead
            className={
              features.stickyHeaders !== false
                ? 'sticky top-0 z-10 bg-gray-50'
                : ''
            }
          >
            {/* Row 1: column names (with colSpan for agg sub-columns) */}
            <tr>
              {/* Expand/collapse all groups */}
              <th
                className="wcdv-group-toggle-all w-8 border-b border-r border-gray-200 bg-gray-50 px-1 py-2 text-center"
                rowSpan={hasAggSubCols ? 2 : 1}
              >
                <button
                  type="button"
                  className="inline-flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-gray-500 hover:text-gray-800 transition-colors"
                  onClick={toggleAll}
                  aria-label={t('TABLE.TOGGLE_ALL_GROUPS') || (allExpanded ? 'Collapse all groups' : 'Expand all groups')}
                >
                  <span
                    className="inline-block transition-transform text-xs"
                    style={{ transform: allExpanded ? 'rotate(90deg)' : 'rotate(0)' }}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                </button>
              </th>
              {columnLayout.map((col) => (
                <th
                  key={col.field}
                  colSpan={col.span}
                  rowSpan={hasAggSubCols && col.aggFns.length === 0 ? 2 : 1}
                  className={`border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 ${
                    col.aggFns.length > 0 ? 'text-center' : ''
                  }`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="columnheader"
                  aria-sort={
                    sort?.field === col.field
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={`flex w-full items-center gap-0.5 bg-transparent border-none p-0 text-left text-inherit font-inherit cursor-pointer ${
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
                    aria-label={t('TABLE.SORT_BY', col.header) || `Sort by ${col.header}`}
                  >
                    <span className="truncate">{col.header}</span>
                    {sort?.field === col.field && (
                      <span className="ml-1 text-blue-500 text-xs">
                        {sort.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
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
                      className="border-b border-r border-gray-200 bg-gray-100 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500"
                    >
                      {aggFnLabels?.[fn] ?? fn}
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
                />
              );
            })}

            {/* Total row */}
            {showTotalRow && (
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                <td className="px-1 py-2 text-center text-xs text-gray-500">
                  Σ
                </td>
                {columnLayout.map((col) => (
                    <td
                      key={col.field}
                      colSpan={col.span}
                      className="border-r border-gray-200 px-3 py-2 text-sm"
                    >
                      {totalAggregates?.[col.field] != null
                        ? String(totalAggregates[col.field])
                        : ''}
                    </td>
                  ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {totalRows != null && (
        <div className="wcdv-table-footer flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          <span>
            {groupOrder.length} {t('TABLE.GROUPS') || 'groups'},{' '}
            {totalRows} {t('TABLE.ROWS') || 'rows'}
          </span>
          {limit &&
            totalRows > (limit.limit ?? 0) &&
            Object.values(groupedRows).reduce((s, r) => s + r.length, 0) <
              totalRows && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                  onClick={onShowMore}
                >
                  {t('TABLE.SHOW_MORE') || 'Show More'}
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                  onClick={onShowAll}
                >
                  {t('TABLE.SHOW_ALL') || 'Show All'}
                </button>
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
}: GroupSectionProps) {
  const aggByField = useMemo(
    () => buildAggByField(meta.aggregates),
    [meta.aggregates],
  );

  return (
    <>
      {/* Group header row — one cell per physical sub-column */}
      <tr
        className="wcdv-group-header bg-gray-100 border-t border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
        role="row"
        aria-expanded={expanded}
        aria-level={meta.level + 1}
        onClick={() => onToggle(groupKey)}
      >
        {/* Chevron toggle */}
        <td className="px-1 py-2 text-center text-xs text-gray-500">
          <span
            className="inline-block transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
            aria-hidden="true"
          >
            ▶
          </span>
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
                className={`border-r border-gray-200 px-3 py-2 text-sm ${
                  fi === 0 ? 'font-semibold text-gray-700' : 'text-center text-gray-600 text-xs'
                }`}
                style={fi === 0 ? { minWidth: first.minWidth ?? 50 } : undefined}
              >
                {fi === 0 && (
                  <>
                    <span>{formatGroupLabel(groupKey, meta)}</span>
                    <span className="ml-2 text-xs font-normal text-gray-400">
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
              className="border-r border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
              style={{ minWidth: first.minWidth ?? 50 }}
            >
              <span>{formatGroupLabel(groupKey, meta)}</span>
              <span className="ml-2 text-xs font-normal text-gray-400">
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
                  className="border-r border-gray-200 px-2 py-2 text-center text-sm text-gray-600"
                >
                  {match ? formatAggValue('', match.value) : ''}
                </td>
              );
            });
          }
          return (
            <td
              key={col.field}
              className="border-r border-gray-200 px-3 py-2 text-sm"
            />
          );
        })}
      </tr>

      {/* Detail rows — data cells span across sub-columns */}
      {expanded &&
        rows.map((row, rowIdx) => {
          const zebraClass =
            features?.zebraStripe !== false && rowIdx % 2 === 1
              ? 'bg-gray-50/50'
              : '';

          return (
            <tr
              key={row.rowId ?? row.rowNum}
              data-row-num={row.rowNum}
              className={`wcdv-tr border-b border-gray-100 transition-colors hover:bg-blue-50/30 ${zebraClass}`}
              role="row"
              aria-level={meta.level + 2}
              onClick={(e) => onRowClick?.(row, e)}
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
                  className={`wcdv-td border-r border-gray-100 px-3 py-1.5 text-sm ${col.className ?? ''}`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="gridcell"
                >
                  {formatCell
                    ? formatCell(row.data[col.field], row.data, col as any)
                    : typeof row.data[col.field] === 'number'
                      ? (row.data[col.field] as number).toLocaleString()
                      : String(row.data[col.field] ?? '')}
                </td>
              ))}
            </tr>
          );
        })}
    </>
  );
}
