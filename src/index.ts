/**
 * @mieweb/datavis — React UI library entry point.
 *
 * Phase 0: Adapter layer (EventBridge, hooks)
 * Phase 1: Grid shell (DataGrid, Toolbar, Slider, OperationsPalette, LoadingOverlay)
 */

import { ensureI18nInit } from './i18n/config';

// Ensure locale resources are registered when consumers import from package root.
ensureI18nInit();

// Adapter layer
export {
  EventBridge,
  useDataVisEvent,
  useDataVisEvents,
  useEventBridge,
  useSource,
  useView,
  usePrefs,
  formatCellValue,
  compareValues,
  buildLocalSourceTypeInfo,
  buildAggregateFunctions,
  getBuiltinGroupFunctions,
  determineColumns,
  toLegacyAggregateSpec,
  type EventEmitter,
  type SourceInstance,
  type ViewInstance,
  type ViewData,
  type WorkEndInfo,
  type SourceSpec,
  type UseSourceReturn,
  type UseViewReturn,
  type PrefsInstance,
  type PerspectiveInfo,
  type UsePrefsReturn,
  type TypeDef,
  type TypeRegistry,
  type FieldTypeInfo,
  type AggregateSpecMap,
  type AggregateSpecItem,
} from './adapters';

// Components
export {
  DataGrid,
  TitleBar,
  GridToolbar,
  DetailSlider,
  OperationsPalette,
  LoadingOverlay,
  PlainToolbar,
  GroupToolbar,
  PivotToolbar,
  PrefsToolbar,
  TableRenderer,
  type DataGridProps,
  type GridTableDef,
  type TableRendererProps,
  type TableColumn,
  type TableFeatures,
  type ColumnFilterConfig,
  type AggregateFunction,
  type GroupFunctionDef,
  type TitleBarProps,
  type GridToolbarProps,
  type DetailSliderProps,
  type Operation,
  type OperationContext,
  type OperationsPaletteProps,
  type LoadingOverlayProps,
} from './components';
