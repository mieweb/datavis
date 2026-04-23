/**
 * ColumnConfigContext — React context for bidirectional column-visibility
 * synchronisation between DataGrid ↔ PlainTable ↔ ColumnConfigDialog.
 *
 * DataGrid provides the context; PlainTable and the ColumnConfigDialog consume it.
 */

import { createContext, useContext } from 'react';

export interface ColumnConfigContextValue {
  /** Set of field names that are currently hidden */
  hiddenFields: Set<string>;
  /** Toggle a column's hidden state (called by context-menu Hide and by the dialog) */
  setColumnHidden: (field: string, hidden: boolean) => void;
  /** Ordered list of visible field names (from column config dialog). Empty = use default order. */
  columnOrder: string[];
  /** Update column order (called by table drag-reorder and dialog save) */
  setColumnOrder: (fields: string[]) => void;
  /** Set of field names that are currently pinned */
  pinnedFields: Set<string>;
  /** Toggle a column's pinned state */
  setColumnPinned: (field: string, pinned: boolean) => void;
}

const defaultValue: ColumnConfigContextValue = {
  hiddenFields: new Set(),
  setColumnHidden: () => {},
  columnOrder: [],
  setColumnOrder: () => {},
  pinnedFields: new Set(),
  setColumnPinned: () => {},
};

export const ColumnConfigContext = createContext<ColumnConfigContextValue>(defaultValue);

export function useColumnConfig(): ColumnConfigContextValue {
  return useContext(ColumnConfigContext);
}
