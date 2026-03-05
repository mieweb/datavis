/**
 * FilterContext — provides dynamic filter management to table header cells.
 *
 * DataGrid creates the provider; PlainTable (or any table renderer) consumes
 * it to show filter icons on column headers and add/remove columns from
 * the filter bar at runtime.
 */

import { createContext, useContext } from 'react';
import type { TableColumn } from '../table/types';
import type { ColumnFilterConfig, FilterType } from './types';

// ───────────────────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────────────────

export interface FilterContextValue {
  /** Add a column to the filter bar */
  addFilterColumn: (field: string) => void;
  /** Remove a dynamically-added column from the filter bar */
  removeFilterColumn: (field: string) => void;
  /** Fields that currently have a filter widget in the bar */
  activeFilterFields: Set<string>;
}

export const FilterContext = createContext<FilterContextValue | null>(null);

/** Consume the FilterContext (returns null when outside DataGrid) */
export function useFilterContext(): FilterContextValue | null {
  return useContext(FilterContext);
}

// ───────────────────────────────────────────────────────────
// Helper — derive ColumnFilterConfig from a TableColumn
// ───────────────────────────────────────────────────────────

/** Map a TableColumn to a ColumnFilterConfig with sensible defaults. */
export function columnToFilterConfig(col: TableColumn): ColumnFilterConfig {
  let filterType: FilterType = 'string';
  const t = col.typeInfo?.type;
  if (t) {
    if (['number', 'integer', 'float', 'percent'].includes(t)) filterType = 'number';
    else if (t === 'currency') filterType = 'currency';
    else if (t === 'date') filterType = 'date';
    else if (t === 'datetime') filterType = 'datetime';
    else if (t === 'boolean') filterType = 'boolean';
  }

  return {
    field: col.field,
    displayName: col.header,
    filterType,
    widget: filterType === 'boolean' ? 'tribool' : 'textbox',
    visible: true,
  };
}
