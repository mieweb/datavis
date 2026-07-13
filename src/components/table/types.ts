/**
 * Table renderer types — shared type definitions for all table sub-renderers.
 *
 * Models the column configuration, sorting, cell rendering, and selection
 * concepts used by the wcdatavis table renderer.
 */

import type React from 'react';

// ───────────────────────────────────────────────────────────
// Column configuration
// ───────────────────────────────────────────────────────────

/** Column definition for the table renderer */
export interface TableColumn {
  /** Internal field name (key in row data) */
  field: string;
  /** Display header text */
  header: string;
  /** Column width in pixels (user-resized or from colConfig) */
  width?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Whether the column is currently visible */
  visible?: boolean;
  /** Whether the column is pinned (frozen) */
  pinned?: boolean;
  /** Text alignment override */
  align?: 'left' | 'center' | 'right';
  /** Custom CSS class for cells in this column */
  className?: string;
  /** Whether this column allows HTML rendering */
  allowHtml?: boolean;
  /** Field type info for formatting */
  typeInfo?: {
    type: string;
    format?: string | Record<string, unknown>;
    internalType?: string;
  };
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether this column is filterable */
  filterable?: boolean;
  /** Whether this column is resizable */
  resizable?: boolean;
  /** Whether this column is reorderable */
  reorderable?: boolean;
}

// ───────────────────────────────────────────────────────────
// Sort
// ───────────────────────────────────────────────────────────

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Active sort spec for a single column */
export interface SortSpec {
  field: string;
  direction: SortDirection;
}

/**
 * Multi-column sort: an ordered list of single-column sort specs in priority
 * order. The first entry is the primary sort key, the second breaks ties
 * within equal primary values, and so on.
 */
export type MultiSortSpec = SortSpec[];

/**
 * Find the active sort entry for a field within a multi-column sort list.
 * Returns the column's direction and its zero-based priority index, or null
 * when the field is not part of the current sort.
 */
export function findSort(
  sorts: MultiSortSpec | null | undefined,
  field: string,
): { direction: SortDirection; index: number } | null {
  if (!sorts) return null;
  const index = sorts.findIndex((s) => s.field === field);
  return index < 0 ? null : { direction: sorts[index].direction, index };
}

// ───────────────────────────────────────────────────────────
// Row data
// ───────────────────────────────────────────────────────────

/** A single row of data — key-value map */
export type RowData = Record<string, unknown>;

/** Row with row-number metadata */
export interface TableRow {
  /** Original row index in the dataset */
  rowNum: number;
  /** Row ID (if available) */
  rowId?: string;
  /** The data values */
  data: RowData;
}

// ───────────────────────────────────────────────────────────
// Selection
// ───────────────────────────────────────────────────────────

/** Row selection state */
export interface SelectionState {
  /** Set of selected row numbers */
  selectedRows: Set<number>;
  /** Currently active (focused) row number */
  activeRow: number | null;
  /** Currently focused column field */
  activeColumn: string | null;
}

// ───────────────────────────────────────────────────────────
// Context menu
// ───────────────────────────────────────────────────────────

/** Context menu item */
export interface ContextMenuItem {
  /** Display label */
  label: string;
  /** Icon (React node or string) */
  icon?: React.ReactNode;
  /** Optional keyboard shortcut display */
  shortcut?: string;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Whether this is a separator */
  separator?: boolean;
  /** Whether this item is currently "checked" / active */
  checked?: boolean;
  /** Nested submenu items */
  children?: ContextMenuItem[];
  /** Action callback */
  onClick?: () => void;
}

// ───────────────────────────────────────────────────────────
// Group / Pivot metadata
// ───────────────────────────────────────────────────────────

/** Group row metadata — used by group-detail and group-summary renderers */
export interface GroupMeta {
  /** Group field values */
  groupValues: Record<string, unknown>;
  /** Number of rows in this group */
  count: number;
  /** Whether this group is expanded (detail mode) */
  expanded: boolean;
  /** Group depth level (0-based) */
  level: number;
  /** Aggregate values for this group */
  aggregates?: Record<string, unknown>;
}

/** Pivot column header — includes row/col val combination */
export interface PivotHeader {
  /** Column value (top-level) */
  colVal: unknown;
  /** Aggregate function name */
  aggFn: string;
  /** Display header */
  header: string;
  /** Original field */
  field: string;
}

// ───────────────────────────────────────────────────────────
// Table features (from GridTableDef.features)
// ───────────────────────────────────────────────────────────

/** Feature flags controlling table behavior */
export interface TableFeatures {
  /** Enable column resizing */
  columnResize?: boolean;
  /** Enable column reordering (DnD) */
  columnReorder?: boolean;
  /** Enable sticky headers */
  stickyHeaders?: boolean;
  /**
   * Enable row selection.
   * - `true` — click selects a row, Shift+click extends the selection
   * - `'checkbox'` — adds a leading checkbox column with a tri-state
   *   select-all header checkbox (applies to the currently filtered rows)
   */
  rowSelection?: boolean | 'checkbox';
  /** Enable context menu on column headers */
  headerContextMenu?: boolean;
  /** Enable zebra striping */
  zebraStripe?: boolean;
  /** Enable keyboard navigation (j/k) */
  keyboardNav?: boolean;
  /** Enable drill-down on double-click */
  drillDown?: boolean;
  /** Enable show-more / limit */
  showMore?: boolean;
  /** Row mode — wrapped or clipped */
  rowMode?: 'wrapped' | 'clipped';
}

// ───────────────────────────────────────────────────────────
// Cell formatter
// ───────────────────────────────────────────────────────────

/** Cell formatter function — returns React node */
export type CellFormatter = (
  value: unknown,
  row: RowData,
  column: TableColumn,
) => React.ReactNode;

// ───────────────────────────────────────────────────────────
// Table renderer props (base)
// ───────────────────────────────────────────────────────────

/** Base props shared by all table sub-renderers */
export interface BaseTableProps {
  /** Column definitions */
  columns: TableColumn[];
  /** Row data */
  rows: TableRow[];
  /** Active multi-column sort, in priority order (empty/null when unsorted) */
  sorts?: MultiSortSpec | null;
  /** Feature flags */
  features?: TableFeatures;
  /** Total number of rows (before limit, for "showing X of Y") */
  totalRows?: number;
  /** Limit configuration */
  limit?: { limit: number; autoShowMore?: boolean };
  /** Custom cell formatter (overrides default) */
  formatCell?: CellFormatter;
  /** When provided, each row gets a disclosure toggle that expands a
      full-width detail row rendered by this callback (plain mode only). */
  renderDetailRow?: (row: TableRow) => React.ReactNode;
  /** Expand (true) or collapse (false) all detail rows. Changing the value
      overrides individual toggles; leave undefined for per-row control only. */
  detailRowsExpanded?: boolean;

  /** Overall aggregate totals — rendered as a sticky footer row */
  aggregates?: Record<string, unknown>;
  /** Map of aggregate function internal names to display labels */
  aggFnLabels?: Record<string, string>;
  /** Whether to show the "Showing N rows" count in the footer. Defaults to true. */
  showRowCount?: boolean;
  /** Seed the row selection on mount (stable row ids) — lets a lifted
      selection survive renderer remounts (e.g. group/pivot round trips) */
  initialSelectedRows?: Set<number>;

  // ── Callbacks ──
  /** Sort requested on a column. When `additive` is true (e.g. shift-click), the column is added to / updated within the existing multi-column sort; otherwise it replaces the current sort. */
  onSort?: (field: string, direction: SortDirection, additive?: boolean) => void;
  /** Row clicked */
  onRowClick?: (row: TableRow, event: React.MouseEvent) => void;
  /** Row double-clicked (drill-down) */
  onRowDoubleClick?: (row: TableRow, event: React.MouseEvent) => void;
  /** Column resized */
  onColumnResize?: (field: string, width: number) => void;
  /** Columns reordered */
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  /** Context menu requested on column header */
  onHeaderContextMenu?: (field: string, event: React.MouseEvent) => void;
  /** Show more rows requested */
  onShowMore?: () => void;
  /** Show all rows requested */
  onShowAll?: () => void;
  /** Selection changed */
  onSelectionChange?: (selection: SelectionState) => void;
  /** Custom className */
  className?: string;
}
