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

// Type exports
export type {
  FilterOperator,
  FieldFilterSpec,
  FilterSpec,
  FilterType,
  FilterWidget,
  ColumnFilterConfig,
} from './filters/types';
