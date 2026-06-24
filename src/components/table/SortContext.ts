/**
 * SortContext — provides sort state and callback to table renderers.
 *
 * DataGrid creates the provider; TableRenderer (and sub-renderers) consume
 * it as a fallback when sort/onSort props are not explicitly passed.
 */

import { createContext, useContext } from 'react';
import type { MultiSortSpec, SortDirection } from './types';

// ───────────────────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────────────────

export interface SortContextValue {
  /** Active multi-column sort, in priority order (empty when unsorted) */
  sorts: MultiSortSpec;
  /**
   * Request a sort change. When `additive` is true (e.g. shift-click), the
   * column is added to / updated within the existing multi-column sort;
   * otherwise it replaces the current sort with just this column.
   */
  onSort: (field: string, direction: SortDirection, additive?: boolean) => void;
}

export const SortContext = createContext<SortContextValue | null>(null);

/** Consume the SortContext (returns null when outside DataGrid) */
export function useSortContext(): SortContextValue | null {
  return useContext(SortContext);
}
