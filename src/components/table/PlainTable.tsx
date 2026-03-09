/**
 * PlainTable — React table renderer for flat (non-grouped, non-pivot) data.
 *
 * Replaces the legacy `GridTablePlain` (1380 lines of jQuery DOM) with a
 * React component using @mieweb/ui patterns and Tailwind CSS.
 *
 * Features:
 * - Column resize (CSS-based mouse drag)
 * - Column reorder (@dnd-kit/sortable)
 * - Sticky headers (CSS sticky)
 * - Context menu on right-click
 * - Sort icons + click-to-sort
 * - Keyboard navigation (j/k, arrow keys)
 * - Row selection (click, shift-click)
 * - Show more / limit
 * - Zebra striping
 * - Wrapped vs clipped row mode
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type {
  BaseTableProps,
  TableColumn,
  TableRow,
  SelectionState,
  SortDirection,
  ContextMenuItem,
} from './types';
import { useColumnResize } from './useColumnResize';
import { useColumnReorder } from './useColumnReorder';
import { useKeyboardNav } from './useKeyboardNav';
import { HeaderContextMenu } from './HeaderContextMenu';
import { useFilterContext } from '../filters/FilterContext';
import { useTranslation, useLocale } from '../../i18n';
import { formatCellValue, formatAggregateNumber, DATE_FORMAT_PRESETS, type DateFormatPreset } from './format-cell';

// ───────────────────────────────────────────────────────────
// Sort icon
// ───────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction?: SortDirection }) {
  const t = useTranslation();
  if (!direction) {
    return (
      <span
        className="ml-1 inline-block text-gray-300 text-xs"
        aria-hidden="true"
      >
        ↕
      </span>
    );
  }
  return (
    <span
      className="ml-1 inline-block text-blue-500 text-xs"
      aria-label={direction === 'asc' ? (t('TABLE.SORTED_ASC') || 'Sorted ascending') : (t('TABLE.SORTED_DESC') || 'Sorted descending')}
    >
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

/** Small funnel icon — filled when filter is active */
function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-3 h-3 flex-shrink-0 ${
        active ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500'
      }`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.5 1.5h13L10 7.5v5l-4-2.5V7.5L1.5 1.5z" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────
// Sortable Header Cell
// ───────────────────────────────────────────────────────────

interface SortableHeaderProps {
  column: TableColumn;
  sortDir?: SortDirection;
  resizable: boolean;
  /** Whether this column currently has an active filter */
  filterActive?: boolean;
  /** Called when the filter icon is clicked */
  onFilterClick?: () => void;
  onSort?: (field: string, direction: SortDirection) => void;
  onResizeStart?: (
    field: string,
    width: number,
    event: React.MouseEvent,
  ) => void;
  onContextMenu?: (field: string, event: React.MouseEvent) => void;
}

function SortableHeaderCell({
  column,
  sortDir,
  resizable,
  filterActive,
  onFilterClick,
  onSort,
  onResizeStart,
  onContextMenu,
}: SortableHeaderProps) {
  const t = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.field });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    width: column.width,
    minWidth: column.minWidth ?? 50,
    maxWidth: column.maxWidth,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = useCallback(() => {
    if (!column.sortable && column.sortable !== undefined) return;
    const nextDir: SortDirection = sortDir === 'asc' ? 'desc' : 'asc';
    onSort?.(column.field, nextDir);
  }, [column.field, column.sortable, sortDir, onSort]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu?.(column.field, e);
    },
    [column.field, onContextMenu],
  );

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`wcdv-th relative select-none border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 ${
        isDragging ? 'z-10 shadow-lg' : ''
      }`}
      aria-sort={
        sortDir === 'asc'
          ? 'ascending'
          : sortDir === 'desc'
          ? 'descending'
          : 'none'
      }
      onContextMenu={handleContextMenu}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center w-full gap-0.5">
        <button
          type="button"
          className="flex flex-1 items-center gap-0.5 min-w-0 bg-transparent border-none p-0 text-left text-inherit font-inherit cursor-pointer"
          onClick={handleClick}
          tabIndex={-1}
          aria-label={t('TABLE.SORT_BY', column.header) || `Sort by ${column.header}`}
        >
          <span className="truncate">{column.header}</span>
          {(column.sortable !== false) && <SortIcon direction={sortDir} />}
        </button>

        {/* Filter icon — adds this column to the filter bar */}
        {onFilterClick && (
          <button
            type="button"
            className="flex-shrink-0 p-0 border-none bg-transparent cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onFilterClick();
            }}
            tabIndex={-1}
            aria-label={filterActive ? (t('TABLE.FILTER_ACTIVE_ON', column.header) || `Filter active on ${column.header}`) : (t('TABLE.ADD_FILTER_FOR', column.header) || `Add filter for ${column.header}`)}
            title={filterActive ? (t('TABLE.FILTER_ACTIVE') || 'Filter active') : (t('TABLE.ADD_FILTER') || 'Add filter')}
          >
            <FilterIcon active={filterActive} />
          </button>
        )}
      </div>

      {/* Resize handle */}
      {resizable && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500"
          onMouseDown={(e) =>
            onResizeStart?.(column.field, column.width ?? 100, e)
          }
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t('TABLE.RESIZE_COLUMN', column.header) || `Resize column ${column.header}`}
        />
      )}
    </th>
  );
}

// ───────────────────────────────────────────────────────────
// Aggregate Footer (plain-mode totals)
// ───────────────────────────────────────────────────────────

/** Parse aggregate keys like "sum(salary)" → { fn, field } */
function parseAggKey(key: string): { fn: string; field: string | null } {
  const m = key.match(/^(\w+)\((\w+)\)$/);
  if (m) return { fn: m[1], field: m[2] };
  return { fn: key, field: null };
}

interface AggregateFooterProps {
  aggregates: Record<string, unknown>;
  aggFnLabels?: Record<string, string>;
  visibleColumns: TableColumn[];
  t: (key: string, ...args: unknown[]) => string;
  locale?: string;
}

function AggregateFooter({ aggregates, aggFnLabels, visibleColumns, t: _t, locale }: AggregateFooterProps) {
  // Group aggregate entries by function name so each fn gets its own row
  const byFn = new Map<string, { field: string | null; value: unknown }[]>();
  for (const [key, value] of Object.entries(aggregates)) {
    const { fn, field } = parseAggKey(key);
    if (!byFn.has(fn)) byFn.set(fn, []);
    byFn.get(fn)!.push({ field, value });
  }

  return (
    <tfoot className="wcdv-agg-footer sticky bottom-0 bg-gray-100 border-t-2 border-gray-300 font-semibold text-sm">
      {[...byFn.entries()].map(([fn, entries]) => {
        const label = aggFnLabels?.[fn] ?? fn.charAt(0).toUpperCase() + fn.slice(1);
        // Build a field→value map for quick lookup
        const fieldMap = new Map(
          entries.filter((e) => e.field != null).map((e) => [e.field!, e.value]),
        );

        return (
          <tr key={fn} className="border-t border-gray-200">
            {visibleColumns.map((col, idx) => {
              const val = fieldMap.get(col.field);
              if (val !== undefined) {
                const formatted = formatAggregateNumber(val, locale);
                return (
                  <td
                    key={col.field}
                    className="px-3 py-1.5 text-right border-r border-gray-200"
                    title={`${label}: ${formatted}`}
                  >
                    <span className="text-gray-500 text-xs mr-1">{label}</span>
                    {formatted}
                  </td>
                );
              }
              // First column of the row — show the function label if no value
              if (idx === 0) {
                return (
                  <td
                    key={col.field}
                    className="px-3 py-1.5 border-r border-gray-200 text-gray-500 text-xs uppercase tracking-wider"
                  >
                    {label}
                  </td>
                );
              }
              return (
                <td key={col.field} className="px-3 py-1.5 border-r border-gray-200" />
              );
            })}
          </tr>
        );
      })}
    </tfoot>
  );
}

// ───────────────────────────────────────────────────────────
// PlainTable
// ───────────────────────────────────────────────────────────

export function PlainTable({
  columns: initialColumns,
  rows,
  sort,
  features = {},
  totalRows,
  limit,
  formatCell,
  trans: transProp,
  aggregates,
  aggFnLabels,
  onSort,
  onRowClick,
  onRowDoubleClick,
  onColumnResize,
  onColumnReorder,
  onHeaderContextMenu,
  onShowMore,
  onShowAll,
  onSelectionChange,
  className = '',
}: BaseTableProps) {
  const t = useTranslation(transProp);
  const locale = useLocale();
  // ── Filter context (provided by DataGrid) ─────
  const filterCtx = useFilterContext();

  // ── Column state ───────────────────────────────
  const [columns, setColumns] = useState<TableColumn[]>(initialColumns);

  // ── Selection state ────────────────────────────
  const [selection, setSelection] = useState<SelectionState>({
    selectedRows: new Set(),
    activeRow: null,
    activeColumn: null,
  });

  // ── Context menu state ─────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
    field: string;
  }>({ open: false, position: { x: 0, y: 0 }, field: '' });

  // ── Per-column date format overrides ──────────
  const [dateFormats, setDateFormats] = useState<Record<string, DateFormatPreset>>({});

  const setDateFormat = useCallback((field: string, preset: DateFormatPreset) => {
    setDateFormats((prev) => ({ ...prev, [field]: preset }));
  }, []);

  const tableRef = useRef<HTMLDivElement>(null);

  // ── Visible columns ───────────────────────────
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible !== false),
    [columns],
  );

  // ── Column resize ─────────────────────────────
  const { handleResizeMouseDown } = useColumnResize(
    useCallback(
      (field: string, width: number) => {
        setColumns((prev) =>
          prev.map((c) => (c.field === field ? { ...c, width } : c)),
        );
        onColumnResize?.(field, width);
      },
      [onColumnResize],
    ),
  );

  // ── Column reorder ────────────────────────────
  const { handleDragEnd, columnIds } = useColumnReorder(
    visibleColumns,
    useCallback(
      (fromIndex: number, toIndex: number) => {
        setColumns((prev) => {
          // Only reorder visible columns; preserve hidden column positions
          const visible = prev.filter((c) => c.visible !== false);
          const hidden = prev.filter((c) => c.visible === false);

          const reordered = [...visible];
          const [moved] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, moved);

          return [...reordered, ...hidden];
        });
        onColumnReorder?.(fromIndex, toIndex);
      },
      [onColumnReorder],
    ),
  );

  // ── Keyboard nav ──────────────────────────────
  const { handleKeyDown } = useKeyboardNav(
    rows,
    selection,
    useCallback(
      (sel: SelectionState) => {
        setSelection(sel);
        onSelectionChange?.(sel);
      },
      [onSelectionChange],
    ),
  );

  // ── DnD sensors ───────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Row click handler ─────────────────────────
  const handleRowClick = useCallback(
    (row: TableRow, event: React.MouseEvent) => {
      const newSelection: SelectionState = {
        ...selection,
        activeRow: row.rowNum,
        selectedRows: event.shiftKey
          ? new Set([...selection.selectedRows, row.rowNum])
          : new Set([row.rowNum]),
      };
      setSelection(newSelection);
      onSelectionChange?.(newSelection);
      onRowClick?.(row, event);
    },
    [selection, onRowClick, onSelectionChange],
  );

  // ── Context menu handler ──────────────────────
  const handleHeaderContextMenu = useCallback(
    (field: string, event: React.MouseEvent) => {
      if (features.headerContextMenu === false) return;
      event.preventDefault();

      if (onHeaderContextMenu) {
        onHeaderContextMenu(field, event);
        return;
      }

      // Default context menu items
      setContextMenu({
        open: true,
        position: { x: event.clientX, y: event.clientY },
        field,
      });
    },
    [features.headerContextMenu, onHeaderContextMenu],
  );

  // Build default context menu items
  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    const col = columns.find((c) => c.field === contextMenu.field);
    if (!col) return [];

    const items: ContextMenuItem[] = [
      {
        label: t('TABLE.SORT_ASC') || 'Sort Ascending',
        icon: '↑',
        onClick: () => onSort?.(col.field, 'asc'),
      },
      {
        label: t('TABLE.SORT_DESC') || 'Sort Descending',
        icon: '↓',
        onClick: () => onSort?.(col.field, 'desc'),
      },
      { separator: true, label: '' },
      {
        label: t('TABLE.HIDE_COLUMN') || 'Hide Column',
        icon: '👁',
        onClick: () => {
          setColumns((prev) =>
            prev.map((c) =>
              c.field === col.field ? { ...c, visible: false } : c,
            ),
          );
        },
      },
    ];

    // Date / datetime columns get a "Date Format" submenu
    const colType = col.typeInfo?.type;
    if (colType === 'date' || colType === 'datetime') {
      const current = dateFormats[col.field] ?? 'short';
      items.push(
        { separator: true, label: '' },
        {
          label: t('TABLE.DATE_FORMAT') || 'Date Format',
          icon: '📅',
          children: DATE_FORMAT_PRESETS.map((p) => ({
            label: `${p.label}  ${p.example}`,
            checked: current === p.key,
            onClick: () => setDateFormat(col.field, p.key),
          })),
        },
      );
    }

    return items;
  }, [contextMenu.field, columns, t, onSort, dateFormats, setDateFormat]);

  // ── Limit / Show More ─────────────────────────
  const isLimited = limit && totalRows && rows.length < totalRows;

  // ── Cell rendering ────────────────────────────
  const renderCell = useCallback(
    (row: TableRow, column: TableColumn): React.ReactNode => {
      const value = row.data[column.field];
      if (formatCell) {
        return formatCell(value, row.data, column);
      }
      return formatCellValue(value, column.typeInfo, locale, dateFormats[column.field]);
    },
    [formatCell, locale, dateFormats],
  );

  // ── Cell alignment ────────────────────────────
  const getCellAlign = useCallback((col: TableColumn): string => {
    if (col.align) return `text-${col.align}`;
    // Auto right-align numeric and date types
    if (
      col.typeInfo?.type &&
      ['number', 'currency', 'integer', 'float', 'percent', 'date', 'datetime'].includes(
        col.typeInfo.type,
      )
    ) {
      return 'text-right';
    }
    return 'text-left';
  }, []);

  return (
    <div
      ref={tableRef}
      className={`wcdv-plain-table flex flex-col h-full ${className}`}
      onKeyDown={features.keyboardNav !== false ? handleKeyDown : undefined}
      tabIndex={features.keyboardNav !== false ? 0 : undefined}
      role="grid"
      aria-rowcount={totalRows ?? rows.length}
    >
      <div className="flex-1 overflow-auto min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={features.columnReorder !== false ? handleDragEnd : undefined}
        >
          <table className="min-w-full border-collapse" role="grid">
            {/* ── Header ── */}
            <thead
              className={
                features.stickyHeaders !== false
                  ? 'sticky top-0 z-10 bg-gray-50'
                  : ''
              }
            >
              <tr>
                <SortableContext
                  items={columnIds}
                  strategy={horizontalListSortingStrategy}
                >
                  {visibleColumns.map((col) => (
                    <SortableHeaderCell
                      key={col.field}
                      column={col}
                      sortDir={
                        sort?.field === col.field ? sort.direction : undefined
                      }
                      resizable={
                        features.columnResize !== false &&
                        col.resizable !== false
                      }
                      filterActive={filterCtx?.activeFilterFields.has(col.field)}
                      onFilterClick={
                        filterCtx
                          ? () => {
                              if (filterCtx.activeFilterFields.has(col.field)) {
                                filterCtx.removeFilterColumn(col.field);
                              } else {
                                filterCtx.addFilterColumn(col.field);
                              }
                            }
                          : undefined
                      }
                      onSort={onSort}
                      onResizeStart={handleResizeMouseDown}
                      onContextMenu={handleHeaderContextMenu}
                    />
                  ))}
                </SortableContext>
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    {t('TABLE.NO_DATA') || 'No data to display'}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  const isActive = selection.activeRow === row.rowNum;
                  const isSelected = selection.selectedRows.has(row.rowNum);
                  const zebraClass =
                    features.zebraStripe !== false && rowIdx % 2 === 1
                      ? 'bg-gray-50/50'
                      : '';

                  return (
                    <tr
                      key={row.rowId ?? row.rowNum}
                      data-row-num={row.rowNum}
                      className={`wcdv-tr border-b border-gray-100 transition-colors
                        ${zebraClass}
                        ${isActive ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}
                        ${isSelected && !isActive ? 'bg-blue-50/50' : ''}
                        ${!isActive && !isSelected ? 'hover:bg-gray-50' : ''}
                        ${features.rowMode === 'clipped' ? '' : ''}
                      `}
                      role="row"
                      aria-rowindex={row.rowNum + 1}
                      aria-selected={isSelected}
                      onClick={(e) => handleRowClick(row, e)}
                      onDoubleClick={
                        onRowDoubleClick
                          ? (e) => onRowDoubleClick(row, e)
                          : undefined
                      }
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.field}
                          className={`wcdv-td border-r border-gray-100 px-3 py-1.5 text-sm ${getCellAlign(col)} ${
                            features.rowMode === 'clipped'
                              ? 'truncate max-w-0'
                              : ''
                          } ${col.className ?? ''}`}
                          style={{
                            width: col.width,
                            minWidth: col.minWidth ?? 50,
                            maxWidth: col.maxWidth,
                          }}
                          role="gridcell"
                        >
                          {renderCell(row, col)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* ── Aggregate footer ── */}
            {aggregates && Object.keys(aggregates).length > 0 && (
              <AggregateFooter
                aggregates={aggregates}
                aggFnLabels={aggFnLabels}
                visibleColumns={visibleColumns}
                t={t}
                locale={locale}
              />
            )}
          </table>
        </DndContext>
      </div>

      {/* ── Footer: show more / row count ── */}
      {(isLimited || totalRows != null) && (
        <div className="wcdv-table-footer flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          <span>
            {t('TABLE.SHOWING') || 'Showing'} {rows.length}
            {totalRows != null && totalRows > rows.length && (
              <>
                {' '}
                {t('TABLE.OF') || 'of'} {totalRows}
              </>
            )}
            {' '}
            {t('TABLE.ROWS') || 'rows'}
          </span>

          {isLimited && (
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                onClick={onShowMore}
                aria-label={t('TABLE.SHOW_MORE') || 'Show more rows'}
              >
                {t('TABLE.SHOW_MORE') || 'Show More'}
              </button>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                onClick={onShowAll}
                aria-label={t('TABLE.SHOW_ALL') || 'Show all rows'}
              >
                {t('TABLE.SHOW_ALL') || 'Show All'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Context Menu ── */}
      <HeaderContextMenu
        open={contextMenu.open}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={() => setContextMenu((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
