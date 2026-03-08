/**
 * ColConfig adapter — bridges the legacy wcdatavis `OrdMap<string, FieldColConfig>`
 * column configuration format to/from React `ColumnConfig[]`.
 *
 * Also provides a `determineColumns` equivalent that derives visible column
 * order from colConfig, typeInfo, and data (matching wcdatavis/src/util/misc.js).
 */

import type { ColumnConfig } from '../components/dialogs/ColumnConfigDialog';

// ───────────────────────────────────────────────────────────
// Legacy types
// ───────────────────────────────────────────────────────────

/** Shape of a single field's column config in wcdatavis. */
export interface LegacyFieldColConfig {
  displayText?: string;
  format?: string;
  format_dateOnly?: string;
  cellAlignment?: string;
  allowHtml?: boolean;
  maxHeight?: number | null;
  isHidden?: boolean;
  isPinned?: boolean;
  canHide?: boolean;
  hideMidnight?: boolean;
  cellTemplate?: string;
  cssClasses?: string;
  allowFormatting?: boolean;
  [key: string]: unknown;
}

/** Serialized OrdMap shape (from OrdMap.serialize()). */
export interface SerializedOrdMap {
  _keys: string[];
  _values: LegacyFieldColConfig[];
}

// ───────────────────────────────────────────────────────────
// Conversion: legacy OrdMap → React ColumnConfig[]
// ───────────────────────────────────────────────────────────

/**
 * Convert a serialized OrdMap colConfig into an array of React ColumnConfig objects.
 * Column order is preserved from the OrdMap key order.
 */
export function ordMapToColumnConfigs(serialized: SerializedOrdMap): ColumnConfig[] {
  const { _keys, _values } = serialized;
  return _keys.map((field, i) => {
    const v = _values[i] ?? {};
    return {
      field,
      displayText: v.displayText ?? field,
      isPinned: v.isPinned ?? false,
      isHidden: v.isHidden ?? false,
      allowHtml: v.allowHtml ?? false,
      allowFormatting: v.allowFormatting !== false,
      canHide: v.canHide !== false,
    };
  });
}

/**
 * Convert a serialized OrdMap into an extended ColumnConfig that preserves
 * all legacy properties for round-trip fidelity.
 */
export function ordMapToExtendedConfigs(
  serialized: SerializedOrdMap,
): (ColumnConfig & LegacyFieldColConfig)[] {
  const { _keys, _values } = serialized;
  return _keys.map((field, i) => {
    const v = _values[i] ?? {};
    return {
      field,
      displayText: v.displayText ?? field,
      isPinned: v.isPinned ?? false,
      isHidden: v.isHidden ?? false,
      allowHtml: v.allowHtml ?? false,
      allowFormatting: v.allowFormatting !== false,
      canHide: v.canHide !== false,
      // Legacy properties preserved for round-trip
      ...v,
    };
  });
}

// ───────────────────────────────────────────────────────────
// Conversion: React ColumnConfig[] → legacy OrdMap
// ───────────────────────────────────────────────────────────

/**
 * Convert React ColumnConfig[] back to a serialized OrdMap for persistence
 * via PrefsModuleGrid.
 *
 * @param configs - The React column configurations (ordered).
 * @param extendedProps - Optional map of field → extra legacy properties
 *   to round-trip (format, cellAlignment, etc.).
 */
export function columnConfigsToOrdMap(
  configs: ColumnConfig[],
  extendedProps?: Record<string, LegacyFieldColConfig>,
): SerializedOrdMap {
  const _keys: string[] = [];
  const _values: LegacyFieldColConfig[] = [];

  for (const col of configs) {
    _keys.push(col.field);
    const base: LegacyFieldColConfig = {
      displayText: col.displayText,
      isPinned: col.isPinned,
      isHidden: col.isHidden,
      allowHtml: col.allowHtml,
      allowFormatting: col.allowFormatting,
      canHide: col.canHide,
    };
    // Merge any extra legacy properties
    const extra = extendedProps?.[col.field];
    if (extra) {
      Object.assign(base, extra);
      // Ensure React-side values take precedence
      base.displayText = col.displayText;
      base.isPinned = col.isPinned;
      base.isHidden = col.isHidden;
      base.allowHtml = col.allowHtml;
    }
    _values.push(base);
  }

  return { _keys, _values };
}

// ───────────────────────────────────────────────────────────
// determineColumns — derives visible column list
// ───────────────────────────────────────────────────────────

/** Minimal typeInfo entry for column derivation. */
export interface FieldTypeEntry {
  type: string;
  displayText?: string;
  [key: string]: unknown;
}

/**
 * Determine the visible, ordered column list — mirrors the logic in
 * `wcdatavis/src/util/misc.js#determineColumns`.
 *
 * Priority:
 * 1. If colConfig has entries → use its order, filter out hidden, pin pinned first.
 * 2. Else if typeInfo has entries → use field order from typeInfo (skip _ prefixed).
 * 3. Else → derive field names from data rows.
 */
export function determineColumns(
  colConfig: ColumnConfig[] | null,
  typeInfo: Record<string, FieldTypeEntry> | null,
  data: Record<string, unknown>[] | null,
): string[] {
  // Case 1: colConfig exists and has entries
  if (colConfig && colConfig.length > 0) {
    const visible = colConfig.filter((c) => !c.isHidden);
    // Pinned columns first, then unpinned, preserving relative order within each group
    const pinned = visible.filter((c) => c.isPinned);
    const unpinned = visible.filter((c) => !c.isPinned);
    return [...pinned, ...unpinned].map((c) => c.field);
  }

  // Case 2: typeInfo exists
  if (typeInfo) {
    const keys = Object.keys(typeInfo);
    if (keys.length > 0) {
      return keys.filter((k) => !k.startsWith('_'));
    }
  }

  // Case 3: derive from data
  if (data && data.length > 0) {
    const fieldSet = new Set<string>();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        if (!key.startsWith('_')) {
          fieldSet.add(key);
        }
      }
    }
    return Array.from(fieldSet);
  }

  return [];
}

/**
 * Build initial ColumnConfig[] from typeInfo when no saved colConfig exists.
 */
export function buildDefaultColumnConfigs(
  typeInfo: Record<string, FieldTypeEntry>,
): ColumnConfig[] {
  return Object.entries(typeInfo)
    .filter(([key]) => !key.startsWith('_'))
    .map(([field, info]) => ({
      field,
      displayText: info.displayText ?? field,
      isPinned: false,
      isHidden: false,
      allowHtml: false,
      allowFormatting: true,
      canHide: true,
    }));
}
