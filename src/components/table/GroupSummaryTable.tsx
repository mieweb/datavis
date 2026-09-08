/**
 * GroupSummaryTable — React table renderer for group-summary mode.
 *
 * Replaces the legacy `GridTableGroupSummary` (400 lines of jQuery DOM).
 * Shows one row per group with aggregate values only (no detail rows).
 */

import { useMemo, useCallback, useRef, useState } from 'react';

import type { BaseTableProps, TableColumn, GroupMeta, SortDirection } from './types';
import { findSort } from './types';
import { useIsConstrained, useViewportSticky } from './useAutoHeight';
import { useTranslation } from 'react-i18next';
import { getAggregateValueForField } from './format-cell';
import { SortIndicator } from './SortIndicator';

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
  sorts,
  features = {},
  totalRows,
  showTotalRow = false,
  totalAggregates,
  onSort,
  onAggregateCellDoubleClick,
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

  const handleSort = (field: string, additive = false) => {
    const current = findSort(sorts, field);
    const nextDir: SortDirection =
      current?.direction === 'asc' ? 'desc' : 'asc';
    onSort?.(field, nextDir, additive);
  };

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
      className={`wcdv-group-summary-table flex flex-col flex-1 min-h-0 ${className}`}
    >
      <div ref={scrollRef} className={`flex-1 min-h-0 overflow-x-auto${isConstrained ? ' overflow-y-auto' : ''}`} onScroll={handleScroll}>
        <table className="w-full border-collapse" role="grid" aria-colcount={summaryColumns.length} aria-rowcount={groupOrder.length + (showTotalRow ? 1 : 0)}>
          <caption className="sr-only">{t('TABLE.CAPTION', { param0: t('GRID_TOOLBAR.GROUP.MODE.SUMMARY') }) || 'Data table: Summary'}</caption>
          {/* Header */}
          <thead
            className={
              features.stickyHeaders !== false
                ? `${isConstrained ? 'sticky top-0' : ''} z-10 bg-muted${isConstrained && containerScrolled ? ' wcdv-thead-shadow' : ''}`
                : ''
            }
          >
            <tr>
              {summaryColumns.map((col) => {
                const sortInfo = findSort(sorts, col.field);
                return (
                <th
                  key={col.field}
                  className="border-b border-r border-border bg-muted px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-muted"
                  style={{
                    width: col.width,
                    minWidth: col.minWidth ?? 50,
                  }}
                  role="columnheader"
                  scope="col"
                  aria-sort={
                    sortInfo
                      ? sortInfo.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={(e) => handleSort(col.field, e.shiftKey)}
                  title={t('TABLE.SORT_MULTI_HINT') || 'Click to sort. Shift+click to add to the sort.'}
                >
                  <span className="truncate">{col.header}</span>
                  {sortInfo && (
                    <SortIndicator
                      direction={sortInfo.direction}
                      index={sortInfo.index}
                      count={sorts?.length ?? 0}
                    />
                  )}
                </th>
                );
              })}
            </tr>
          </thead>

          {/* Body: one row per group */}
          <tbody>
            {groupOrder.length === 0 ? (
              <tr>
                <td
                  colSpan={summaryColumns.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {t('TABLE.NO_DATA') || 'No data to display'}
                </td>
              </tr>
            ) : (
              groupOrder.map((groupKey, idx) => {
                const meta = groups[groupKey];
                const zebraClass =
                  features.zebraStripe !== false && idx % 2 === 1
                    ? 'bg-muted/50'
                    : '';

                return (
                  <tr
                    key={groupKey}
                    className={`wcdv-tr border-b border-border transition-colors hover:bg-muted ${zebraClass}`}
                    role="row"
                    aria-rowindex={idx + 2}
                  >
                    {summaryColumns.map((col) => {
                      // Group field → show group value
                      if (groupFields.includes(col.field)) {
                        return (
                          <td
                            key={col.field}
                            className="border-r border-border px-2 py-1 text-sm font-medium"
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
                          data-drilldown-cell
                          className="border-r border-border px-2 py-1 text-sm text-right"
                          style={{
                            width: col.width,
                            minWidth: col.minWidth ?? 50,
                          }}
                          role="gridcell"
                          onDoubleClick={(event) => onAggregateCellDoubleClick?.(meta.groupValues, event)}
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
              <tr className="bg-muted font-semibold border-t-2 border-border">
                {summaryColumns.map((col, idx) => (
                  <td
                    key={col.field}
                    data-drilldown-cell={!groupFields.includes(col.field) ? '' : undefined}
                    className="border-r border-border px-2 py-1 text-sm"
                    onDoubleClick={!groupFields.includes(col.field)
                      ? (event) => onAggregateCellDoubleClick?.({}, event)
                      : undefined}
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
        <div className="wcdv-table-footer flex items-center justify-between border-t border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {groupOrder.length} {t('TABLE.GROUPS') || 'groups'},{' '}
            {totalRows} {t('TABLE.ROWS') || 'rows total'}
          </span>
        </div>
      )}
    </div>
  );
}
