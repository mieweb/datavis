/**
 * SortContext — provides sort state and callback to table renderers.
 *
 * DataGrid creates the provider; TableRenderer (and sub-renderers) consume
 * it as a fallback when sort/onSort props are not explicitly passed.
 */

import { createContext, useContext } from 'react';
import type { SortSpec, SortDirection } from './types';

// ───────────────────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────────────────

export interface SortContextValue {
  /** Current sort specification */
  sort: SortSpec | null;
  /** Request a sort change */
  onSort: (field: string, direction: SortDirection) => void;
}

export const SortContext = createContext<SortContextValue | null>(null);

/** Consume the SortContext (returns null when outside DataGrid) */
export function useSortContext(): SortContextValue | null {
  return useContext(SortContext);
}
