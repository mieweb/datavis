/**
 * PivotTable — React table renderer for pivot mode.
 *
 * Replaces the legacy `GridTablePivot` (930 lines of jQuery DOM).
 * Shows a matrix of row-values × column-values with aggregate cells.
 */

import { useMemo } from 'react';
import type { BaseTableProps, PivotHeader, SortDirection } from './types';
import { useTranslation } from 'react-i18next';
import { SortGlyphIcon } from '../ui';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

/** Pivot data shape from wcdatavis ComputedView */
export interface PivotData {
  /** Row value fields */
  rowFields: string[];
  /** Column value fields */
  colFields: string[];
  /** Unique row values (each is a Record of rowField → value) */
  rowVals: Record<string, unknown>[];
  /** Unique column values */
  colVals: unknown[];
  /** The matrix: rowIdx → colIdx → aggregate values */
  matrix: Record<string, unknown>[][];
  /** Aggregate function names */
  aggFunctions: string[];
  /** Total column aggregates (one per row) */
  totalCol?: Record<string, unknown>[];
  /** Total row aggregates (one per col) */
  totalRow?: Record<string, unknown>[];
  /** Grand total */
  grandTotal?: Record<string, unknown>;
}

export interface PivotTableProps extends Omit<BaseTableProps, 'rows'> {
  /** Pivot data from view */
  pivotData: PivotData;
  /** Whether to show a total column */
  showTotalCol?: boolean;
  /** Whether to hide bottom-value aggregate results */
  hideBottomValueAggResults?: boolean;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function PivotTable({
  columns,
  pivotData,
  sort,
  features = {},
  showTotalCol = true,
  onSort,
  className = '',
}: PivotTableProps) {
  const { t } = useTranslation();
  const {
    rowFields,
    colVals,
    rowVals,
    matrix,
    aggFunctions,
    totalCol,
    totalRow,
    grandTotal,
  } = pivotData;

  // Build row-value column definitions
  const rowColumns = useMemo(
    () =>
      rowFields.map((field) => {
        const col = columns.find((c) => c.field === field);
        return {
          field,
          header: col?.header ?? field,
          width: col?.width,
          minWidth: col?.minWidth ?? 80,
        };
      }),
    [rowFields, columns],
  );

  // Build pivot column headers (colVal × aggFn)
  const pivotHeaders = useMemo<PivotHeader[]>(() => {
    const headers: PivotHeader[] = [];
    for (const colVal of colVals) {
      for (const aggFn of aggFunctions) {
        headers.push({
          colVal,
          aggFn,
          header:
            aggFunctions.length === 1
              ? String(colVal)
              : `${colVal} (${aggFn})`,
          field: `${colVal}_${aggFn}`,
        });
      }
    }
    return headers;
  }, [colVals, aggFunctions]);

  const handleSort = (field: string) => {
    const nextDir: SortDirection =
      sort?.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    onSort?.(field, nextDir);
  };

  return (
    <div
      className={`wcdv-pivot-table flex flex-col h-full ${className}`}
      role="grid"
      aria-rowcount={rowVals.length + 1}
    >
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse" role="grid">
          {/* Header row 1: column value groups */}
          <thead
            className={
              features.stickyHeaders !== false
                ? 'sticky top-0 z-10 bg-gray-50'
                : ''
            }
          >
            {/* Top header: row field labels + column value spans */}
            <tr>
              {rowColumns.map((col) => (
                <th
                  key={col.field}
                  className="border-b border-r border-gray-200 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 cursor-pointer hover:bg-gray-200"
                  style={{ width: col.width, minWidth: col.minWidth }}
                  rowSpan={aggFunctions.length > 1 ? 2 : 1}
                  role="columnheader"
                  onClick={() => handleSort(col.field)}
                >
                  <span className="truncate">{col.header}</span>
                  {sort?.field === col.field && (
                    <span className="ml-1 text-blue-500 text-xs">
                      <SortGlyphIcon className="text-blue-500" direction={sort.direction} />
                    </span>
                  )}
                </th>
              ))}
              {colVals.map((colVal) => (
                <th
                  key={String(colVal)}
                  className="border-b border-r border-gray-200 bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700"
                  colSpan={aggFunctions.length}
                >
                  {String(colVal)}
                </th>
              ))}
              {showTotalCol && (
                <th
                  className="border-b border-r border-gray-200 bg-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-700"
                  colSpan={aggFunctions.length}
                >
                  {t('TABLE.TOTAL') || 'Total'}
                </th>
              )}
            </tr>

            {/* Sub-header: aggregate function names (if multiple) */}
            {aggFunctions.length > 1 && (
              <tr>
                {colVals.map((colVal) =>
                  aggFunctions.map((fn) => (
                    <th
                      key={`${colVal}_${fn}`}
                      className="border-b border-r border-gray-200 bg-blue-50/50 px-2 py-1 text-center text-xs text-blue-600"
                    >
                      {fn}
                    </th>
                  )),
                )}
                {showTotalCol &&
                  aggFunctions.map((fn) => (
                    <th
                      key={`total_${fn}`}
                      className="border-b border-r border-gray-200 bg-gray-100 px-2 py-1 text-center text-xs text-gray-600"
                    >
                      {fn}
                    </th>
                  ))}
              </tr>
            )}
          </thead>

          {/* Body: one row per row-value combination */}
          <tbody>
            {rowVals.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    rowColumns.length +
                    pivotHeaders.length +
                    (showTotalCol ? aggFunctions.length : 0)
                  }
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {t('TABLE.NO_DATA') || 'No data to display'}
                </td>
              </tr>
            ) : (
              rowVals.map((rowVal, rowIdx) => {
                const zebraClass =
                  features.zebraStripe !== false && rowIdx % 2 === 1
                    ? 'bg-gray-50/50'
                    : '';

                return (
                  <tr
                    key={rowIdx}
                    className={`wcdv-tr border-b border-gray-100 transition-colors hover:bg-gray-50 ${zebraClass}`}
                    role="row"
                    aria-rowindex={rowIdx + 2}
                  >
                    {/* Row value cells */}
                    {rowColumns.map((col) => (
                      <td
                        key={col.field}
                        className="border-r border-gray-100 px-3 py-1.5 text-sm font-medium"
                        style={{
                          width: col.width,
                          minWidth: col.minWidth,
                        }}
                        role="rowheader"
                      >
                        {String(rowVal[col.field] ?? '')}
                      </td>
                    ))}

                    {/* Data cells: matrix[rowIdx][colIdx][aggFn] */}
                    {colVals.map((_, colIdx) =>
                      aggFunctions.map((fn) => (
                        <td
                          key={`${colIdx}_${fn}`}
                          className="border-r border-gray-100 px-2 py-1.5 text-sm text-right"
                          role="gridcell"
                        >
                          {matrix[rowIdx]?.[colIdx]?.[fn] != null
                            ? String(matrix[rowIdx][colIdx][fn])
                            : ''}
                        </td>
                      )),
                    )}

                    {/* Total column */}
                    {showTotalCol &&
                      aggFunctions.map((fn) => (
                        <td
                          key={`total_${fn}`}
                          className="border-r border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-right font-medium"
                          role="gridcell"
                        >
                          {totalCol?.[rowIdx]?.[fn] != null
                            ? String(totalCol[rowIdx][fn])
                            : ''}
                        </td>
                      ))}
                  </tr>
                );
              })
            )}

            {/* Total row */}
            {totalRow && (
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                {rowColumns.map((col, idx) => (
                  <td
                    key={col.field}
                    className="border-r border-gray-200 px-3 py-2 text-sm"
                  >
                    {idx === 0 ? t('TABLE.TOTAL') || 'Total' : ''}
                  </td>
                ))}
                {colVals.map((_, colIdx) =>
                  aggFunctions.map((fn) => (
                    <td
                      key={`total_${colIdx}_${fn}`}
                      className="border-r border-gray-200 px-2 py-2 text-sm text-right"
                    >
                      {totalRow[colIdx]?.[fn] != null
                        ? String(totalRow[colIdx][fn])
                        : ''}
                    </td>
                  )),
                )}
                {showTotalCol &&
                  aggFunctions.map((fn) => (
                    <td
                      key={`grand_${fn}`}
                      className="border-r border-gray-200 bg-gray-200 px-2 py-2 text-sm text-right font-bold"
                    >
                      {grandTotal?.[fn] != null ? String(grandTotal[fn]) : ''}
                    </td>
                  ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="wcdv-table-footer flex items-center border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
        <span>
          {rowVals.length} {t('TABLE.ROWS') || 'rows'} × {colVals.length}{' '}
          {t('TABLE.COLUMNS') || 'columns'}
        </span>
      </div>
    </div>
  );
}
