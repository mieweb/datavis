/**
 * Adapter layer — public API.
 *
 * Re-exports all hooks and utilities for bridging wcdatavis core
 * data-processing objects into React components.
 */

export {
  EventBridge,
  useDataVisEvent,
  useDataVisEvents,
  useEventBridge,
  type EventEmitter,
} from './event-bridge';

export {
  useSource,
  useView,
  type SourceInstance,
  type ViewInstance,
  type ViewData,
  type WorkEndInfo,
  type SourceSpec,
  type UseSourceReturn,
  type UseViewReturn,
} from './use-data';

export {
  usePrefs,
  type PrefsInstance,
  type PerspectiveInfo,
  type UsePrefsReturn,
} from './use-prefs';

export {
  formatCellValue,
  compareValues,
  type TypeDef,
  type TypeRegistry,
  type FieldTypeInfo,
} from './type-adapter';

export {
  applyGroupFunction,
  compareViewValues,
  sortRows,
  computeAggregateValue,
  computeAggregateMap,
  buildGroupMetadata,
  buildPivotData,
  type AggregateSpec,
  type ViewSortSpec,
  type GroupMetadataEntry,
  type GroupTransformResult,
  type PivotTransformResult,
} from './view-transforms';

export {
  adaptGroupFunctionRegistry,
  getBuiltinGroupFunctions,
  filterGroupFunctionsForType,
  supportsGroup,
  needsGroupFunction,
  buildGroupSpec,
  getGroupFunctionLabel,
  GROUP_FUNCTION_ALLOWED_TYPES,
  type GroupSpec,
  type GroupFieldSpec,
  type LegacyGroupFunction,
} from './group-adapter';

export {
  ordMapToColumnConfigs,
  ordMapToExtendedConfigs,
  columnConfigsToOrdMap,
  determineColumns,
  buildDefaultColumnConfigs,
  type LegacyFieldColConfig,
  type SerializedOrdMap,
  type FieldTypeEntry,
} from './colconfig-adapter';
