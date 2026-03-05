/**
 * Table components — public exports.
 */

// Types
export type {
  TableColumn,
  SortDirection,
  SortSpec,
  RowData,
  TableRow,
  SelectionState,
  ContextMenuItem,
  GroupMeta,
  PivotHeader,
  TableFeatures,
  CellFormatter,
  BaseTableProps,
} from './types';

// Main renderer
export { TableRenderer, type TableRendererProps } from './TableRenderer';

// Sub-renderers
export { PlainTable } from './PlainTable';
export { GroupDetailTable, type GroupDetailTableProps } from './GroupDetailTable';
export { GroupSummaryTable, type GroupSummaryTableProps } from './GroupSummaryTable';
export { PivotTable, type PivotTableProps, type PivotData } from './PivotTable';

// Supporting components
export { HeaderContextMenu, type HeaderContextMenuProps } from './HeaderContextMenu';
export { TableProgress, type TableProgressProps } from './TableProgress';
export { SortContext, useSortContext, type SortContextValue } from './SortContext';

// Hooks
export { useColumnResize } from './useColumnResize';
export { useColumnReorder } from './useColumnReorder';
export { useKeyboardNav } from './useKeyboardNav';
