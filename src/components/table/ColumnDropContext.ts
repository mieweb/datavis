/**
 * ColumnDropContext — enables table headers to signal drag lifecycle
 * events to the parent DataGrid (e.g. auto-open controls panel).
 *
 * DataGrid provides this context; PlainTable consumes it in onDragStart.
 */

import { createContext, useContext } from 'react';

export interface ColumnDropContextValue {
  /** Called when a column header drag starts (e.g. to auto-open controls). */
  onColumnDragStart?: () => void;
}

const ColumnDropContext = createContext<ColumnDropContextValue>({});

export const ColumnDropProvider = ColumnDropContext.Provider;

export function useColumnDrop(): ColumnDropContextValue {
  return useContext(ColumnDropContext);
}
