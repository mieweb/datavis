/**
 * GroupDetailTable — React table renderer for group-detail mode.
 *
 * Replaces the legacy `GridTableGroupDetail` (1419 lines of jQuery DOM).
 * Shows data rows grouped by field values, with collapsible group headers
 * showing aggregate values.
 */

import { useState, useCallback, useMemo } from 'react';

import type {
  BaseTableProps,
  TableRow,
  GroupMeta,
  SortDirection,
} from './types';
import { useTranslation } from '../../i18n';

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

  // Format aggregate display
  const formatAggregates = useCallback(
    (aggregates?: Record<string, unknown>): string => {
      if (!aggregates) return '';
      return Object.entries(aggregates)
        .map(([key, val]) => `${key}: ${val}`)
        .join(' | ');
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
            <tr>
              {/* Expand/collapse all groups */}
              <th className="wcdv-group-toggle-all w-8 border-b border-r border-gray-200 bg-gray-50 px-1 py-2 text-center">
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
              {dataColumns
                .filter((c) => c.visible !== false)
                .map((col) => (
                  <th
                    key={col.field}
                    className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
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
                      className="flex w-full items-center gap-0.5 bg-transparent border-none p-0 text-left text-inherit font-inherit cursor-pointer"
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
                  columns={dataColumns.filter((c) => c.visible !== false)}
                  features={features}
                  formatCell={formatCell}
                  formatGroupLabel={formatGroupLabel}
                  formatAggregates={formatAggregates}
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
                {dataColumns
                  .filter((c) => c.visible !== false)
                  .map((col) => (
                    <td
                      key={col.field}
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
  columns: { field: string; header: string; width?: number; minWidth?: number; className?: string }[];
  features: BaseTableProps['features'];
  formatCell?: BaseTableProps['formatCell'];
  formatGroupLabel: (key: string, meta: GroupMeta) => string;
  formatAggregates: (agg?: Record<string, unknown>) => string;
  onToggle: (key: string) => void;
  onRowClick?: BaseTableProps['onRowClick'];
  onRowDoubleClick?: BaseTableProps['onRowDoubleClick'];
}

function GroupSection({
  groupKey,
  meta,
  rows,
  expanded,
  columns,
  features,
  formatCell,
  formatGroupLabel,
  formatAggregates,
  onToggle,
  onRowClick,
  onRowDoubleClick,
}: GroupSectionProps) {
  return (
    <>
      {/* Group header row */}
      <tr
        className="wcdv-group-header bg-gray-100 border-t border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
        role="row"
        aria-expanded={expanded}
        aria-level={meta.level + 1}
        onClick={() => onToggle(groupKey)}
      >
        <td className="px-1 py-2 text-center text-xs text-gray-500">
          <span
            className="inline-block transition-transform"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
            aria-hidden="true"
          >
            ▶
          </span>
        </td>
        <td
          colSpan={columns.length}
          className="px-3 py-2 text-sm font-semibold text-gray-700"
        >
          <span>{formatGroupLabel(groupKey, meta)}</span>
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({meta.count} {meta.count === 1 ? 'row' : 'rows'})
          </span>
          {meta.aggregates && (
            <span className="ml-3 text-xs font-normal text-gray-500">
              {formatAggregates(meta.aggregates)}
            </span>
          )}
        </td>
      </tr>

      {/* Detail rows */}
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
              {columns.map((col) => (
                <td
                  key={col.field}
                  className={`wcdv-td border-r border-gray-100 px-3 py-1.5 text-sm ${col.className ?? ''}`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="gridcell"
                >
                  {formatCell
                    ? formatCell(row.data[col.field], row.data, col as any)
                    : String(row.data[col.field] ?? '')}
                </td>
              ))}
            </tr>
          );
        })}
    </>
  );
}
