/**
 * Table renderer types — shared type definitions for all table sub-renderers.
 *
 * Models the column configuration, sorting, cell rendering, and selection
 * concepts used by the wcdatavis table renderer.
 */

import type React from 'react';
import type { TransFn } from '../../i18n';

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

/** Active sort spec */
export interface SortSpec {
  field: string;
  direction: SortDirection;
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
  /** Enable row selection */
  rowSelection?: boolean;
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
  /** Currently active sort */
  sort?: SortSpec | null;
  /** Feature flags */
  features?: TableFeatures;
  /** Total number of rows (before limit, for "showing X of Y") */
  totalRows?: number;
  /** Limit configuration */
  limit?: { limit: number; autoShowMore?: boolean };
  /** Custom cell formatter (overrides default) */
  formatCell?: CellFormatter;
  /** i18n function */
  trans?: TransFn;

  // ── Callbacks ──
  /** Sort requested on a column */
  onSort?: (field: string, direction: SortDirection) => void;
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
