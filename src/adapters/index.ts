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
