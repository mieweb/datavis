/**
 * TableRenderer — Unified table renderer that selects the appropriate
 * sub-renderer based on data mode (plain / group-detail / group-summary / pivot).
 *
 * This is the single component consumers pass into `<DataGrid>` to render
 * the table content area.
 */

import { useMemo } from 'react';

import type {
  TableColumn,
  TableRow,
  SortSpec,
  SortDirection,
  TableFeatures,
  CellFormatter,
  SelectionState,
  GroupMeta,
} from './types';
import { PlainTable } from './PlainTable';
import { GroupDetailTable } from './GroupDetailTable';
import { GroupSummaryTable } from './GroupSummaryTable';
import { PivotTable, type PivotData } from './PivotTable';
import { TableProgress } from './TableProgress';
import { useSortContext } from './SortContext';
import type { ViewData } from '../../adapters/use-data';
import { useTranslation } from 'react-i18next';

function serializeGroupKey(groupFields: string[], row: Record<string, unknown>): string {
  return groupFields
    .map((field) => `${field}:${String(row[field] ?? '')}`)
    .join('|||');
}

// ───────────────────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────────────────

export interface TableRendererProps {
  /** Processed view data from useView() */
  viewData: ViewData | null;
  /** Column definitions */
  columns: TableColumn[];
  /** Current sort specification */
  sort?: SortSpec | null;
  /** Feature flags */
  features?: TableFeatures;
  /** Total row count (before limit) */
  totalRows?: number;
  /** Limit configuration */
  limit?: { limit: number; autoShowMore?: boolean };
  /** Row count loaded so far (for progress bar) */
  loadedRows?: number;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Custom cell formatter */
  formatCell?: CellFormatter;
  /** Group mode: 'detail' | 'summary' */
  groupMode?: 'detail' | 'summary';
  /** Whether to show total row (group/pivot) */
  showTotalRow?: boolean;
  /** Whether to show total column (pivot) */
  showTotalCol?: boolean;
  /** Whether to start groups expanded */
  groupsExpanded?: boolean;
  /** Map of aggregate function internal names to display labels */
  aggFnLabels?: Record<string, string>;
  /** Custom className */
  className?: string;
  /** When true, group data should be displayed as a pivot (pivot without explicit grouping) */
  syntheticPivot?: boolean;

  // ── Callbacks ──
  /** Sort requested */
  onSort?: (field: string, direction: SortDirection) => void;
  /** Row clicked */
  onRowClick?: (row: TableRow, event: React.MouseEvent) => void;
  /** Row double-clicked (drill-down) */
  onRowDoubleClick?: (row: TableRow, event: React.MouseEvent) => void;
  /** Column resized */
  onColumnResize?: (field: string, width: number) => void;
  /** Columns reordered */
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  /** Context menu on header */
  onHeaderContextMenu?: (field: string, event: React.MouseEvent) => void;
  /** Show more rows */
  onShowMore?: () => void;
  /** Show all rows */
  onShowAll?: () => void;
  /** Selection changed */
  onSelectionChange?: (selection: SelectionState) => void;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function TableRenderer({
  viewData,
  columns,
  sort,
  features = {},
  totalRows,
  limit,
  loadedRows,
  loading = false,
  formatCell,
  groupMode = 'detail',
  showTotalRow = false,
  showTotalCol = true,
  groupsExpanded = true,
  aggFnLabels,
  className = '',
  syntheticPivot = false,
  onSort,
  onRowClick,
  onRowDoubleClick,
  onColumnResize,
  onColumnReorder,
  onHeaderContextMenu,
  onShowMore,
  onShowAll,
  onSelectionChange,
}: TableRendererProps) {
  const { t } = useTranslation();

  // Fall back to SortContext when sort/onSort props are not explicitly passed
  const sortCtx = useSortContext();
  const effectiveSort = sort !== undefined ? sort : sortCtx?.sort ?? null;
  const effectiveOnSort = onSort ?? sortCtx?.onSort;

  // ── Build rows from view data ─────────────────
  const plainRows = useMemo<TableRow[]>(() => {
    if (!viewData?.isPlain || !Array.isArray(viewData.data)) return [];
    return viewData.data.map((row, idx) => ({
      rowNum: idx,
      rowId: (row as Record<string, unknown>)?._rowId as string | undefined,
      data: row as Record<string, unknown>,
    }));
  }, [viewData]);

  // ── Group data extraction ─────────────────────
  const groupData = useMemo(() => {
    if (!viewData?.isGroup) return null;

    const groupFields = viewData.groupFields ?? [];
    const data = viewData.data as Record<string, unknown>[];
    const groupMetadata = viewData.groupMetadata as Record<string, unknown> | undefined;

    // Build groups from data
    const groups: Record<string, GroupMeta> = {};
    const groupedRows: Record<string, TableRow[]> = {};
    const groupOrder: string[] = [];

    if (groupMetadata) {
      // Use group metadata for headers (aggregates, count, etc.)
      for (const [key, meta] of Object.entries(groupMetadata)) {
        const m = meta as Record<string, unknown>;
        groups[key] = {
          groupValues: (m.groupValues as Record<string, unknown>) ?? {},
          count: (m.count as number) ?? 0,
          expanded: true,
          level: (m.level as number) ?? 0,
          aggregates: m.aggregates as Record<string, unknown> | undefined,
        };
        groupOrder.push(key);
        groupedRows[key] = [];
      }

      // Bucket data rows into groups (metadata only has headers)
      for (const [idx, row] of data.entries()) {
        const key = serializeGroupKey(groupFields, row);
        if (!groupedRows[key]) groupedRows[key] = [];
        groupedRows[key].push({ rowNum: idx, data: row });
      }
    } else if (data.length > 0) {
      // No metadata — derive groups entirely from data
      for (const [idx, row] of data.entries()) {
        const key = serializeGroupKey(groupFields, row);

        if (!groups[key]) {
          groups[key] = {
            groupValues: Object.fromEntries(
              groupFields.map((f) => [f, row[f]]),
            ),
            count: 0,
            expanded: true,
            level: 0,
          };
          groupOrder.push(key);
          groupedRows[key] = [];
        }

        groups[key].count++;
        groupedRows[key].push({
          rowNum: idx,
          data: row,
        });
      }
    }

    return { groups, groupedRows, groupOrder, groupFields };
  }, [viewData]);

  // ── Pivot data extraction ─────────────────────
  const pivotData = useMemo<PivotData | null>(() => {
    if (!viewData?.isPivot) return null;

    const rowVals = (viewData.rowVals ?? []) as Record<string, unknown>[];
    const colVals = (viewData.colVals ?? []) as unknown[];
    const data = viewData.data as Record<string, unknown>[];
    const groupFields = viewData.groupFields ?? [];
    const pivotFields = viewData.pivotFields ?? [];

    // Derive aggregate function keys matching the format used by buildAggregateRecord:
    // "fun(field)" for field-based aggregates, or just "fun" for fieldless ones (e.g. count).
    const aggFunctions = viewData.agg
      ? (viewData.agg as Array<{ fun?: string; fn?: string; fields?: string[] }>).map((a) => {
          const fn = a.fun ?? a.fn;
          const field = a.fields?.[0];
          return field ? `${fn}(${field})` : fn ?? 'count';
        })
      : ['count'];

    return {
      rowFields: groupFields,
      colFields: pivotFields,
      rowVals,
      colVals,
      matrix: data as unknown as Record<string, unknown>[][],
      aggFunctions,
      totalCol: (viewData.totalCol ?? []) as Record<string, unknown>[],
      totalRow: (viewData.totalRow ?? []) as Record<string, unknown>[],
      grandTotal: (viewData.grandTotal ?? {}) as Record<string, unknown>,
    };
  }, [viewData]);

  // ── Synthetic pivot: transform group data into pivot format ──
  // When pivot fields were set without a group, the library groups by
  // those fields. We transpose the groups into pivot columns.
  const syntheticPivotData = useMemo<PivotData | null>(() => {
    if (!syntheticPivot || !groupData) return null;

    const { groups, groupOrder, groupFields: gf } = groupData;

    // Each group becomes a column value
    const colVals = groupOrder.map((key) => {
      const vals = groups[key].groupValues;
      // Join multi-field group values for display
      return gf.length === 1
        ? vals[gf[0]]
        : gf.map((f) => String(vals[f] ?? '')).join(' / ');
    });

    // Derive aggregate function keys from the first group's aggregates
    const sampleAgg = groups[groupOrder[0]]?.aggregates ?? {};
    const aggFunctions = Object.keys(sampleAgg).length > 0
      ? Object.keys(sampleAgg)
      : ['count'];

    // Build a single-row matrix: one row, with each column being a group's aggregates
    const matrix: Record<string, unknown>[][] = [
      groupOrder.map((key) => {
        const agg = groups[key].aggregates ?? {};
        // If no aggregates, fall back to count
        return Object.keys(agg).length > 0 ? agg : { count: groups[key].count };
      }),
    ];

    // Total column: aggregate across all groups (sum of counts, etc.)
    const totalAgg: Record<string, unknown> = {};
    for (const fn of aggFunctions) {
      const vals = groupOrder.map((key) => {
        const agg = groups[key].aggregates ?? {};
        return (agg[fn] ?? groups[key].count) as number;
      });
      totalAgg[fn] = vals.reduce((a, b) => (typeof a === 'number' && typeof b === 'number' ? a + b : a), 0);
    }

    return {
      rowFields: [],
      colFields: gf,
      rowVals: [{}],
      colVals,
      matrix,
      aggFunctions,
      totalCol: [totalAgg],
      totalRow: [],
      grandTotal: totalAgg,
    };
  }, [syntheticPivot, groupData]);

  // No data yet
  if (!viewData) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-neutral-500 py-12">
        {t('TABLE.WAITING') || 'Waiting for data…'}
      </div>
    );
  }

  // Show progress bar during incremental loading
  const showProgress = loading && loadedRows != null && totalRows != null;

  return (
    <div className={`wcdv-table-renderer flex flex-col flex-1 min-h-0 ${className}`}>
      {/* Progress bar */}
      {showProgress && (
        <TableProgress
          loaded={loadedRows!}
          total={totalRows!}
          active={loading}
        />
      )}

      {/* Plain mode */}
      {viewData.isPlain && (
        <PlainTable
          columns={columns}
          rows={plainRows}
          sort={effectiveSort}
          features={features}
          totalRows={totalRows}
          limit={limit}
          formatCell={formatCell}
          aggregates={viewData.totalAggregates as Record<string, unknown> | undefined}
          aggFnLabels={aggFnLabels}
          onSort={effectiveOnSort}
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          onColumnResize={onColumnResize}
          onColumnReorder={onColumnReorder}
          onHeaderContextMenu={onHeaderContextMenu}
          onShowMore={onShowMore}
          onShowAll={onShowAll}
          onSelectionChange={onSelectionChange}
        />
      )}

      {/* Group mode (not in synthetic pivot) */}
      {viewData.isGroup && groupData && !syntheticPivot && (
        groupMode === 'summary' ? (
          <GroupSummaryTable
            columns={columns}
            groups={groupData.groups}
            groupOrder={groupData.groupOrder}
            groupFields={groupData.groupFields}
            sort={effectiveSort}
            features={features}
            totalRows={totalRows}
            showTotalRow={showTotalRow}
            totalAggregates={viewData.totalAggregates as Record<string, unknown> | undefined}
            onSort={effectiveOnSort}
          />
        ) : (
          <GroupDetailTable
            columns={columns}
            rows={[]}
            groups={groupData.groups}
            groupedRows={groupData.groupedRows}
            groupOrder={groupData.groupOrder}
            groupFields={groupData.groupFields}
            sort={effectiveSort}
            features={features}
            totalRows={totalRows}
            limit={limit}
            formatCell={formatCell}
            showTotalRow={showTotalRow}
            initialExpanded={groupsExpanded}
            aggFnLabels={aggFnLabels}
            onSort={effectiveOnSort}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            onColumnResize={onColumnResize}
            onColumnReorder={onColumnReorder}
            onHeaderContextMenu={onHeaderContextMenu}
            onShowMore={onShowMore}
            onShowAll={onShowAll}
            onSelectionChange={onSelectionChange}
          />
        )
      )}

      {/* Pivot mode */}
      {viewData.isPivot && pivotData && (
        <PivotTable
          columns={columns}
          pivotData={pivotData}
          sort={effectiveSort}
          features={features}
          showTotalCol={showTotalCol}
          onSort={effectiveOnSort}
        />
      )}

      {/* Synthetic pivot: group data displayed as pivot */}
      {syntheticPivot && syntheticPivotData && viewData.isGroup && (
        <PivotTable
          columns={columns}
          pivotData={syntheticPivotData}
          sort={effectiveSort}
          features={features}
          showTotalCol={showTotalCol}
          onSort={effectiveOnSort}
        />
      )}
    </div>
  );
}
