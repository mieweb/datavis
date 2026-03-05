/**
 * Components — public exports.
 */

export { DataGrid, type DataGridProps, type GridTableDef } from './DataGrid';
export { TitleBar, type TitleBarProps } from './TitleBar';
export { GridToolbar, type GridToolbarProps } from './GridToolbar';
export { DetailSlider, type DetailSliderProps } from './DetailSlider';
export { OperationsPalette, type Operation, type OperationContext, type OperationsPaletteProps } from './OperationsPalette';
export { LoadingOverlay, type LoadingOverlayProps } from './LoadingOverlay';

// Toolbar sub-components
export { PlainToolbar } from './toolbars/PlainToolbar';
export { GroupToolbar } from './toolbars/GroupToolbar';
export { PivotToolbar } from './toolbars/PivotToolbar';
export { PrefsToolbar } from './toolbars/PrefsToolbar';

// Filter components (Phase 2)
export { FilterBar, type FilterBarProps } from './filters/FilterBar';
export { StringFilter, type StringFilterProps } from './filters/StringFilter';
export { NumberFilter, type NumberFilterProps } from './filters/NumberFilter';
export { DateFilter, type DateFilterProps } from './filters/DateFilter';
export { BooleanFilter, type BooleanFilterProps } from './filters/BooleanFilter';
export { FilterOperatorSelect } from './filters/FilterOperatorSelect';

// Control panel components (Phase 2)
export { ControlPanel, type ControlPanelProps } from './controls/ControlPanel';
export { ControlSection, type ControlSectionProps, type ControlFieldItem, type AvailableField } from './controls/ControlSection';
export { AggregateSection, type AggregateSectionProps, type AggregateFunction, type AggregateEntry } from './controls/AggregateSection';
export { FieldPill, type FieldPillProps } from './controls/FieldPill';

// Dialog components (Phase 3)
export {
  ColumnConfigDialog,
  type ColumnConfig,
  type ColumnConfigDialogProps,
} from './dialogs/ColumnConfigDialog';
export {
  TemplateEditorDialog,
  type TemplateSlots,
  type TemplateData,
  type TemplateEditorDialogProps,
} from './dialogs/TemplateEditorDialog';
export {
  DebugDialog,
  type DebugSourceInfo,
  type DebugViewInfo,
  type DebugGridInfo,
  type DebugPrefsInfo,
  type DebugDialogProps,
} from './dialogs/DebugDialog';
export {
  GridTableOptionsDialog,
  type DisplayFormatConfig,
  type GridTableOptionsDialogProps,
} from './dialogs/GridTableOptionsDialog';
export {
  GroupFunctionDialog,
  type GroupFunctionDialogProps,
} from './dialogs/GroupFunctionDialog';
export type { GroupFunction as GroupFunctionDef } from './dialogs/GroupFunctionDialog';
export {
  PerspectiveManagerDialog,
  type PerspectiveInfo,
  type PerspectiveManagerDialogProps,
} from './dialogs/PerspectiveManagerDialog';

// Table renderer components (Phase 4)
export {
  TableRenderer,
  type TableRendererProps,
} from './table/TableRenderer';
export {
  PlainTable,
} from './table/PlainTable';
export {
  GroupDetailTable,
  type GroupDetailTableProps,
} from './table/GroupDetailTable';
export {
  GroupSummaryTable,
  type GroupSummaryTableProps,
} from './table/GroupSummaryTable';
export {
  PivotTable,
  type PivotTableProps,
  type PivotData,
} from './table/PivotTable';
export {
  HeaderContextMenu,
  type HeaderContextMenuProps,
} from './table/HeaderContextMenu';
export {
  TableProgress,
  type TableProgressProps,
} from './table/TableProgress';
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
} from './table/types';

// Type exports
export type {
  FilterOperator,
  FieldFilterSpec,
  FilterSpec,
  FilterType,
  FilterWidget,
  ColumnFilterConfig,
} from './filters/types';
