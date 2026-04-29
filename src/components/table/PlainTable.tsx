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

import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from '@mieweb/ui/components/Button';

import type {
  BaseTableProps,
  TableColumn,
  TableRow,
  SelectionState,
  SortDirection,
  ContextMenuItem,
} from './types';
import { useColumnResize } from './useColumnResize';
import { useKeyboardNav } from './useKeyboardNav';
import { useColumnDrop } from './ColumnDropContext';
import { HeaderContextMenu } from './HeaderContextMenu';
import { useFilterContext } from '../filters/FilterContext';
import { useColumnConfig } from './ColumnConfigContext';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../i18n';
import { CalendarIcon, ChevronGlyphIcon, IconButton, SearchIcon, SortGlyphIcon, TableActionButton } from '../ui';
import { formatCellValue, formatAggregateNumber, DATE_FORMAT_PRESETS, type DateFormatPreset } from './format-cell';
import { COLUMN_DRAG_MIME } from '../controls/column-drag';

// ───────────────────────────────────────────────────────────
// Sort icon
// ───────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction?: SortDirection }) {
  const { t } = useTranslation();
  if (!direction) {
    return (
      <span
        className="ml-1 inline-block text-gray-300 dark:text-neutral-600 text-xs"
        aria-hidden="true"
      >
        <SortGlyphIcon className="text-gray-300 dark:text-neutral-600" />
      </span>
    );
  }
  return (
    <span
      className="ml-1 inline-block text-blue-500 dark:text-blue-400 text-xs"
      aria-label={direction === 'asc' ? (t('TABLE.SORTED_ASC') || 'Sorted ascending') : (t('TABLE.SORTED_DESC') || 'Sorted descending')}
    >
      <SortGlyphIcon className="text-blue-500 dark:text-blue-400" direction={direction} />
    </span>
  );
}

/** Small funnel icon — filled when filter is active */
function FilterIcon({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-3 h-3 flex-shrink-0 ${
        active ? 'text-blue-500 dark:text-blue-400' : 'text-gray-300 dark:text-neutral-600 hover:text-gray-500 dark:hover:text-neutral-400'
      }`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.5 1.5h13L10 7.5v5l-4-2.5V7.5L1.5 1.5z" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────
// Header Cell (native HTML5 drag)
// ───────────────────────────────────────────────────────────

/** Which side of a target header the dragged column would be inserted */
type InsertSide = 'before' | 'after';

interface HeaderCellProps {
  column: TableColumn;
  sortDir?: SortDirection;
  resizable: boolean;
  filterActive?: boolean;
  /** Sticky pin style for pinned columns (position, left, zIndex) */
  pinStyle?: React.CSSProperties;
  /** Whether this is the last pinned column (shows separator shadow) */
  isLastPinned?: boolean;
  onFilterClick?: () => void;
  onSort?: (field: string, direction: SortDirection) => void;
  onResizeStart?: (
    field: string,
    width: number,
    event: React.MouseEvent,
  ) => void;
  onContextMenu?: (field: string, event: React.MouseEvent) => void;
  /** Which side to show the insertion indicator on, if any */
  insertIndicator?: InsertSide | null;
  onHeaderDragStart?: (field: string, e: React.DragEvent) => void;
  onHeaderDragOver?: (field: string, e: React.DragEvent) => void;
  onHeaderDragLeave?: (e: React.DragEvent) => void;
  onHeaderDrop?: (field: string, e: React.DragEvent) => void;
  onHeaderDragEnd?: () => void;
}

function HeaderCell({
  column,
  sortDir,
  resizable,
  filterActive,
  pinStyle,
  isLastPinned,
  onFilterClick,
  onSort,
  onResizeStart,
  onContextMenu,
  insertIndicator,
  onHeaderDragStart,
  onHeaderDragOver,
  onHeaderDragLeave,
  onHeaderDrop,
  onHeaderDragEnd,
}: HeaderCellProps) {
  const { t } = useTranslation();
  const thRef = useRef<HTMLTableCellElement>(null);

  const style: React.CSSProperties = {
    width: column.width,
    minWidth: column.minWidth ?? 50,
    maxWidth: column.maxWidth,
    ...pinStyle,
    // Pinned header cells are sticky in both axes — boost z above the sticky thead (z-10)
    ...(pinStyle ? { zIndex: 20 + (pinStyle.zIndex as number) } : {}),
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
      ref={thRef}
      style={style}
      draggable
      onDragStart={(e) => onHeaderDragStart?.(column.field, e)}
      onDragOver={(e) => onHeaderDragOver?.(column.field, e)}
      onDragLeave={(e) => onHeaderDragLeave?.(e)}
      onDrop={(e) => onHeaderDrop?.(column.field, e)}
      onDragEnd={() => onHeaderDragEnd?.()}
      className={`wcdv-th relative select-none border-b border-r border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-neutral-400 cursor-grab active:cursor-grabbing${isLastPinned ? ' wcdv-pin-separator' : ''}`}
      scope="col"
      aria-sort={
        sortDir === 'asc'
          ? 'ascending'
          : sortDir === 'desc'
          ? 'descending'
          : 'none'
      }
      onContextMenu={handleContextMenu}
    >
      {/* Insertion indicator — left edge */}
      {insertIndicator === 'before' && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 dark:bg-blue-400 z-20" />
      )}
      {/* Insertion indicator — right edge */}
      {insertIndicator === 'after' && (
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-blue-500 dark:bg-blue-400 z-20" />
      )}
      <div className="flex items-center w-full gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="flex h-auto flex-1 min-w-0 items-center justify-start gap-0.5 bg-transparent p-0 text-left text-inherit font-inherit uppercase tracking-wider shadow-none hover:bg-transparent"
          onClick={handleClick}
          tabIndex={-1}
          aria-label={t('TABLE.SORT_BY', { param0: column.header }) || `Sort by ${column.header}`}
        >
          <span className="truncate">{column.header}</span>
          {(column.sortable !== false) && <SortIcon direction={sortDir} />}
        </Button>

        {/* Filter icon — adds this column to the filter bar */}
        {onFilterClick && (
          <IconButton
            type="button"
            variant="ghost"
            className="h-5 w-5 flex-shrink-0 p-0 shadow-none hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              onFilterClick();
            }}
            tabIndex={-1}
            aria-label={filterActive ? (t('TABLE.FILTER_ACTIVE_ON', { param0: column.header }) || `Filter active on ${column.header}`) : (t('TABLE.ADD_FILTER_FOR', { param0: column.header }) || `Add filter for ${column.header}`)}
            title={filterActive ? (t('TABLE.FILTER_ACTIVE') || 'Filter active') : (t('TABLE.ADD_FILTER') || 'Add filter')}
          >
            <FilterIcon active={filterActive} />
          </IconButton>
        )}
      </div>

      {/* Resize handle */}
      {resizable && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-500 active:bg-blue-500 dark:active:bg-blue-400"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            const offsetW = thRef.current?.offsetWidth;
            const propW = column.width;
            const actualWidth = offsetW ?? propW ?? 100;
            console.log('[resize-start]', column.field, { offsetW, propW, actualWidth, thRef: thRef.current });
            onResizeStart?.(column.field, actualWidth, e);
          }}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuenow={column.width ?? 100}
          aria-valuemin={column.minWidth ?? 50}
          aria-label={t('TABLE.RESIZE_COLUMN', { param0: column.header }) || `Resize column ${column.header}`}
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
  locale?: string;
  pinStyles?: Map<string, React.CSSProperties>;
  pinnedCount?: number;
}

function AggregateFooter({ aggregates, aggFnLabels, visibleColumns, locale, pinStyles, pinnedCount = 0 }: AggregateFooterProps) {
  const { t } = useTranslation();
  // Group aggregate entries by function name so each fn gets its own row
  const byFn = new Map<string, { field: string | null; value: unknown }[]>();
  for (const [key, value] of Object.entries(aggregates)) {
    const { fn, field } = parseAggKey(key);
    if (!byFn.has(fn)) byFn.set(fn, []);
    byFn.get(fn)!.push({ field, value });
  }

  return (
    <tfoot className="wcdv-agg-footer sticky bottom-0 bg-gray-100 dark:bg-neutral-800 border-t-2 border-gray-300 dark:border-neutral-600 font-semibold text-sm">
      {[...byFn.entries()].map(([fn, entries]) => {
        const rawLabel = aggFnLabels?.[fn] ?? fn;
        const label = t(rawLabel);
        // Build a field→value map for quick lookup
        const fieldMap = new Map(
          entries.filter((e) => e.field != null).map((e) => [e.field!, e.value]),
        );

        return (
          <tr key={fn} className="border-t border-gray-200 dark:border-neutral-700">
            {visibleColumns.map((col, idx) => {
              const val = fieldMap.get(col.field);
              const footPinStyle = pinStyles?.get(col.field);
              const isLastPin = pinnedCount > 0 && idx === pinnedCount - 1;
              const pinCls = `${footPinStyle ? ' bg-inherit' : ''}${isLastPin ? ' wcdv-pin-separator' : ''}`;
              if (val !== undefined) {
                const formatted = formatAggregateNumber(val, locale);
                return (
                  <td
                    key={col.field}
                    className={`px-3 py-1.5 text-right border-r border-gray-200 dark:border-neutral-700${pinCls}`}
                    style={footPinStyle}
                    title={`${label}: ${formatted}`}
                  >
                    <span className="text-gray-500 dark:text-neutral-400 text-xs mr-1">{label}</span>
                    {formatted}
                  </td>
                );
              }
              // First column of the row — show the function label if no value
              if (idx === 0) {
                return (
                  <td
                    key={col.field}
                    className={`px-3 py-1.5 border-r border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-wider${pinCls}`}
                    style={footPinStyle}
                  >
                    {label}
                  </td>
                );
              }
              return (
                <td key={col.field} className={`px-3 py-1.5 border-r border-gray-200 dark:border-neutral-700${pinCls}`} style={footPinStyle} />
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
  const { t } = useTranslation();
  const locale = useLocale();
  // ── Filter context (provided by DataGrid) ─────
  const filterCtx = useFilterContext();
  // ── Column config context (provided by DataGrid) ─
  const colConfigCtx = useColumnConfig();

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingAutoShowRef = useRef(false);
  const columnDropCtx = useColumnDrop();

  /** Native drag state: source field, target field, and insertion side */
  const dragSourceRef = useRef<string | null>(null);
  const [dragTarget, setDragTarget] = useState<{ field: string; side: InsertSide } | null>(null);

  // ── Visible columns (filtered + ordered by column config) ──
  const visibleColumns = useMemo(() => {
    const visible = columns.filter((c) => c.visible !== false && !colConfigCtx.hiddenFields.has(c.field));
    // If a column order is provided via config context, sort to match it
    if (colConfigCtx.columnOrder.length > 0) {
      const orderIndex = new Map(colConfigCtx.columnOrder.map((f, i) => [f, i]));
      visible.sort((a, b) => {
        const ai = orderIndex.get(a.field) ?? Infinity;
        const bi = orderIndex.get(b.field) ?? Infinity;
        return ai - bi;
      });
    }
    return visible;
  }, [columns, colConfigCtx.hiddenFields, colConfigCtx.columnOrder]);

  // ── Pinned column state ──
  const pinnedSet = colConfigCtx.pinnedFields;
  const pinnedCount = useMemo(
    () => visibleColumns.filter((c) => pinnedSet.has(c.field)).length,
    [visibleColumns, pinnedSet],
  );
  const [pinStyles, setPinStyles] = useState<Map<string, React.CSSProperties>>(new Map());

  // Measure actual <th> widths and compute sticky left offsets after render
  useLayoutEffect(() => {
    if (pinnedCount === 0) {
      setPinStyles(new Map());
      return;
    }
    const thead = scrollContainerRef.current?.querySelector('thead');
    if (!thead) return;
    const ths = thead.querySelectorAll('th');
    const styles = new Map<string, React.CSSProperties>();
    let cumulativeLeft = 0;
    for (let i = 0; i < pinnedCount && i < ths.length; i++) {
      const col = visibleColumns[i];
      const actualWidth = ths[i].offsetWidth;
      styles.set(col.field, {
        position: 'sticky',
        left: cumulativeLeft,
        zIndex: pinnedCount - i,
      });
      cumulativeLeft += actualWidth;
    }
    setPinStyles(styles);
  }, [pinnedCount, visibleColumns, columns]);

  // ── Column resize ─────────────────────────────
  const { handleResizeMouseDown } = useColumnResize(
    useCallback(
      (field: string, width: number) => {
        console.log('[PlainTable] onResize callback', { field, width });
        setColumns((prev) =>
          prev.map((c) => (c.field === field ? { ...c, width } : c)),
        );
        onColumnResize?.(field, width);
      },
      [onColumnResize],
    ),
  );

  // ── Column reorder ────────────────────────────
  const commitColumnReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      const fields = visibleColumns.map((c) => c.field);
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      colConfigCtx.setColumnOrder(fields);
      onColumnReorder?.(fromIndex, toIndex);
    },
    [visibleColumns, colConfigCtx, onColumnReorder],
  );

  // ── Native drag handlers for column headers ──
  // Support both in-table column reorder and cross-zone drops
  // into the control panel (filter, group, pivot).

  const handleHeaderDragStart = useCallback(
    (field: string, e: React.DragEvent) => {
      dragSourceRef.current = field;
      e.dataTransfer.setData(COLUMN_DRAG_MIME, field);
      e.dataTransfer.effectAllowed = 'copyMove';
      // Set a semi-transparent drag image from the <th>
      const th = (e.target as HTMLElement).closest('th');
      if (th) e.dataTransfer.setDragImage(th, th.offsetWidth / 2, th.offsetHeight / 2);
      columnDropCtx.onColumnDragStart?.();
    },
    [columnDropCtx],
  );

  const handleHeaderDragOver = useCallback(
    (field: string, e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(COLUMN_DRAG_MIME)) return;
      // Enforce pin boundary: only allow drop on same-zone columns
      const sourceField = dragSourceRef.current;
      if (sourceField) {
        const sourceIsPinned = pinnedSet.has(sourceField);
        const targetIsPinned = pinnedSet.has(field);
        if (sourceIsPinned !== targetIsPinned) return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Determine insertion side based on cursor position within the <th>
      const th = (e.currentTarget as HTMLElement).closest('th');
      if (!th) return;
      const rect = th.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const side: InsertSide = e.clientX < midX ? 'before' : 'after';
      setDragTarget((prev) =>
        prev?.field === field && prev?.side === side ? prev : { field, side },
      );
    },
    [pinnedSet],
  );

  const handleHeaderDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the <th> (not entering a child)
    const th = (e.currentTarget as HTMLElement).closest('th');
    if (th && !th.contains(e.relatedTarget as Node)) {
      setDragTarget(null);
    }
  }, []);

  const handleHeaderDrop = useCallback(
    (targetField: string, e: React.DragEvent) => {
      e.preventDefault();
      setDragTarget(null);
      const sourceField = e.dataTransfer.getData(COLUMN_DRAG_MIME);
      if (!sourceField || sourceField === targetField) return;

      // Enforce pin boundary: pinned ↔ pinned only, unpinned ↔ unpinned only
      if (pinnedSet.has(sourceField) !== pinnedSet.has(targetField)) return;

      // Determine insertion side
      const th = (e.currentTarget as HTMLElement).closest('th');
      const rect = th?.getBoundingClientRect();
      const side: InsertSide = rect && e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';

      const fields = visibleColumns.map((c) => c.field);
      const fromIndex = fields.indexOf(sourceField);
      let toIndex = fields.indexOf(targetField);
      if (fromIndex === -1 || toIndex === -1) return;

      // Adjust toIndex based on insertion side
      if (side === 'after') toIndex += 1;
      // Account for the source being removed first
      if (fromIndex < toIndex) toIndex -= 1;
      if (fromIndex === toIndex) return;

      commitColumnReorder(fromIndex, toIndex);
    },
    [visibleColumns, commitColumnReorder, pinnedSet],
  );

  const handleHeaderDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragTarget(null);
  }, []);

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
    useCallback(
      (row: TableRow, event: React.KeyboardEvent) => {
        onRowClick?.(row, event as unknown as React.MouseEvent);
      },
      [onRowClick],
    ),
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
        icon: <ChevronGlyphIcon className="h-4 w-4" direction="up" />,
        onClick: () => onSort?.(col.field, 'asc'),
      },
      {
        label: t('TABLE.SORT_DESC') || 'Sort Descending',
        icon: <ChevronGlyphIcon className="h-4 w-4" direction="down" />,
        onClick: () => onSort?.(col.field, 'desc'),
      },
      { separator: true, label: '' },
      {
        label: t('TABLE.HIDE_COLUMN') || 'Hide Column',
        icon: <SearchIcon className="h-4 w-4" />,
        onClick: () => {
          // Notify DataGrid via context so column config dialog stays in sync
          colConfigCtx.setColumnHidden(col.field, true);
          setColumns((prev) =>
            prev.map((c) =>
              c.field === col.field ? { ...c, visible: false } : c,
            ),
          );
        },
      },
      {
        label: pinnedSet.has(col.field)
          ? (t('TABLE.UNPIN_COLUMN') || 'Unpin Column')
          : (t('TABLE.PIN_COLUMN') || 'Pin Column'),
        onClick: () => {
          colConfigCtx.setColumnPinned(col.field, !pinnedSet.has(col.field));
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
          icon: <CalendarIcon className="h-4 w-4" />,
          children: DATE_FORMAT_PRESETS.map((p) => ({
            label: `${p.label}  ${p.example}`,
            checked: current === p.key,
            onClick: () => setDateFormat(col.field, p.key),
          })),
        },
      );
    }

    return items;
  }, [contextMenu.field, columns, t, onSort, dateFormats, setDateFormat, colConfigCtx, pinnedSet]);

  // ── Limit / Show More ─────────────────────────
  const isLimited = limit && totalRows && rows.length < totalRows;

  useEffect(() => {
    pendingAutoShowRef.current = false;
  }, [rows.length]);

  const handleScroll = useCallback(() => {
    if (!isLimited || limit?.autoShowMore === false || !onShowMore || pendingAutoShowRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    const remainingScroll = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (remainingScroll > 24) return;

    pendingAutoShowRef.current = true;
    onShowMore();
  }, [isLimited, limit?.autoShowMore, onShowMore]);

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
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto min-h-0"
        data-testid="plain-table-scroll"
        onScroll={handleScroll}
      >
          <table className="min-w-full border-collapse" role="grid" aria-colcount={visibleColumns.length} aria-rowcount={totalRows ?? rows.length}>
            <caption className="sr-only">{t('TABLE.CAPTION', { param0: t('GRID_TOOLBAR.PLAIN.ROW_MODE') }) || 'Data table: Plain'}</caption>
            {/* ── Header ── */}
            <thead
              className={
                features.stickyHeaders !== false
                  ? 'sticky top-0 z-10 bg-gray-50 dark:bg-neutral-800'
                  : ''
              }
            >
              <tr>
                  {visibleColumns.map((col, colIdx) => (
                    <HeaderCell
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
                      pinStyle={pinStyles.get(col.field)}
                      isLastPinned={pinnedCount > 0 && colIdx === pinnedCount - 1}
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
                      insertIndicator={
                        dragTarget?.field === col.field ? dragTarget.side : null
                      }
                      onHeaderDragStart={handleHeaderDragStart}
                      onHeaderDragOver={handleHeaderDragOver}
                      onHeaderDragLeave={handleHeaderDragLeave}
                      onHeaderDrop={handleHeaderDrop}
                      onHeaderDragEnd={handleHeaderDragEnd}
                    />
                  ))}
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-neutral-500"
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
                      ? 'bg-gray-50/50 dark:bg-neutral-800/50'
                      : '';

                  return (
                    <tr
                      key={row.rowId ?? row.rowNum}
                      data-row-num={row.rowNum}
                      className={`wcdv-tr border-b border-gray-100 dark:border-neutral-700 transition-colors
                        ${zebraClass}
                        ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-200 dark:ring-blue-700' : ''}
                        ${isSelected && !isActive ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
                        ${!isActive && !isSelected ? 'hover:bg-gray-50 dark:hover:bg-neutral-800' : ''}
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
                      {visibleColumns.map((col, colIdx) => {
                        const bodyPinStyle = pinStyles.get(col.field);
                        const isLastPin = pinnedCount > 0 && colIdx === pinnedCount - 1;
                        return (
                        <td
                          key={col.field}
                          className={`wcdv-td border-r border-gray-100 dark:border-neutral-700 px-3 py-1.5 text-sm ${getCellAlign(col)} ${
                            features.rowMode === 'clipped'
                              ? 'truncate max-w-0'
                              : ''
                          } ${col.className ?? ''}${bodyPinStyle ? ' bg-white dark:bg-neutral-900' : ''}${isLastPin ? ' wcdv-pin-separator' : ''}`}
                          style={{
                            width: col.width,
                            minWidth: col.minWidth ?? 50,
                            maxWidth: col.maxWidth,
                            ...bodyPinStyle,
                          }}
                          role="gridcell"
                        >
                          {renderCell(row, col)}
                        </td>
                        );
                      })}
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
                locale={locale}
                pinStyles={pinStyles}
                pinnedCount={pinnedCount}
              />
            )}
          </table>
      </div>

      {/* ── Footer: show more / row count ── */}
      {(isLimited || totalRows != null) && (
        <div className="wcdv-table-footer flex items-center justify-between border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 px-3 py-1.5 text-xs text-gray-500 dark:text-neutral-400">
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
              <TableActionButton
                type="button"
                variant="ghost"
                className="h-auto px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                onClick={onShowMore}
                aria-label={t('TABLE.SHOW_MORE') || 'Show more rows'}
              >
                {t('TABLE.SHOW_MORE') || 'Show More'}
              </TableActionButton>
              <TableActionButton
                type="button"
                variant="ghost"
                className="h-auto px-2 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                onClick={onShowAll}
                aria-label={t('TABLE.SHOW_ALL') || 'Show all rows'}
              >
                {t('TABLE.SHOW_ALL') || 'Show All'}
              </TableActionButton>
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
