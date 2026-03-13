/**
 * GroupSummaryTable — React table renderer for group-summary mode.
 *
 * Replaces the legacy `GridTableGroupSummary` (400 lines of jQuery DOM).
 * Shows one row per group with aggregate values only (no detail rows).
 */

import { useMemo } from 'react';

import type { BaseTableProps, TableColumn, GroupMeta, SortDirection } from './types';
import { useTranslation } from 'react-i18next';
import { getAggregateValueForField } from './format-cell';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface GroupSummaryTableProps extends Omit<BaseTableProps, 'rows'> {
  /** Group metadata keyed by group key */
  groups: Record<string, GroupMeta>;
  /** Ordered group keys */
  groupOrder: string[];
  /** Fields used for grouping */
  groupFields: string[];
  /** Aggregate column definitions (overrides columns for the summary view) */
  aggregateColumns?: TableColumn[];
  /** Whether to show a total row */
  showTotalRow?: boolean;
  /** Total-row aggregate values */
  totalAggregates?: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function GroupSummaryTable({
  columns,
  groups,
  groupOrder,
  groupFields,
  aggregateColumns,
  sort,
  features = {},
  totalRows,
  showTotalRow = false,
  totalAggregates,
  onSort,
  className = '',
}: GroupSummaryTableProps) {
  const { t } = useTranslation();
  const firstGroup = groupOrder.length > 0 ? groups[groupOrder[0]] : undefined;

  // Build column list: group fields first, then aggregate columns
  const summaryColumns = useMemo(() => {
    const groupCols = groupFields.map((field) => {
      const col = columns.find((c) => c.field === field);
      return {
        field,
        header: col?.header ?? field,
        width: col?.width,
        minWidth: col?.minWidth,
        sortable: true,
      } as TableColumn;
    });

    const aggCols = aggregateColumns
      ?? (firstGroup?.aggregates
        ? Object.keys(firstGroup.aggregates).map((key) => ({
            field: key,
            header: key,
            sortable: true,
          } as TableColumn))
        : columns.filter((c) => !groupFields.includes(c.field) && c.visible !== false));

    return [...groupCols, ...aggCols];
  }, [columns, groupFields, aggregateColumns, firstGroup]);

  const handleSort = (field: string) => {
    const nextDir: SortDirection =
      sort?.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort?.(field, nextDir);
  };

  return (
    <div
      className={`wcdv-group-summary-table flex flex-col h-full ${className}`}
      role="grid"
      aria-rowcount={groupOrder.length + (showTotalRow ? 1 : 0)}
    >
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse" role="grid">
          {/* Header */}
          <thead
            className={
              features.stickyHeaders !== false
                ? 'sticky top-0 z-10 bg-gray-50'
                : ''
            }
          >
            <tr>
              {summaryColumns.map((col) => (
                <th
                  key={col.field}
                  className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-100"
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
                  onClick={() => handleSort(col.field)}
                >
                  <span className="truncate">{col.header}</span>
                  {sort?.field === col.field && (
                    <span className="ml-1 text-blue-500 text-xs">
                      {sort.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body: one row per group */}
          <tbody>
            {groupOrder.length === 0 ? (
              <tr>
                <td
                  colSpan={summaryColumns.length}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {t('TABLE.NO_DATA') || 'No data to display'}
                </td>
              </tr>
            ) : (
              groupOrder.map((groupKey, idx) => {
                const meta = groups[groupKey];
                const zebraClass =
                  features.zebraStripe !== false && idx % 2 === 1
                    ? 'bg-gray-50/50'
                    : '';

                return (
                  <tr
                    key={groupKey}
                    className={`wcdv-tr border-b border-gray-100 transition-colors hover:bg-gray-50 ${zebraClass}`}
                    role="row"
                    aria-rowindex={idx + 2}
                  >
                    {summaryColumns.map((col) => {
                      // Group field → show group value
                      if (groupFields.includes(col.field)) {
                        return (
                          <td
                            key={col.field}
                            className="border-r border-gray-100 px-3 py-2 text-sm font-medium"
                            style={{
                              width: col.width,
                              minWidth: col.minWidth ?? 50,
                            }}
                            role="gridcell"
                          >
                            {String(meta.groupValues[col.field] ?? '(empty)')}
                          </td>
                        );
                      }

                      // Aggregate column → show aggregate value
                      return (
                        <td
                          key={col.field}
                          className="border-r border-gray-100 px-3 py-2 text-sm text-right"
                          style={{
                            width: col.width,
                            minWidth: col.minWidth ?? 50,
                          }}
                          role="gridcell"
                        >
                          {(() => {
                            const aggregateValue = getAggregateValueForField(meta.aggregates, col.field);
                            return aggregateValue != null ? String(aggregateValue) : '';
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}

            {/* Total row */}
            {showTotalRow && (
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                {summaryColumns.map((col, idx) => (
                  <td
                    key={col.field}
                    className="border-r border-gray-200 px-3 py-2 text-sm"
                  >
                    {idx === 0
                      ? `${t('TABLE.TOTAL') || 'Total'} (${groupOrder.length})`
                      : groupFields.includes(col.field)
                      ? ''
                      : getAggregateValueForField(totalAggregates, col.field) != null
                      ? String(getAggregateValueForField(totalAggregates, col.field))
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
            {totalRows} {t('TABLE.ROWS') || 'rows total'}
          </span>
        </div>
      )}
    </div>
  );
}
