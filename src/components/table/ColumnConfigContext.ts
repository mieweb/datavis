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
}

const defaultValue: ColumnConfigContextValue = {
  hiddenFields: new Set(),
  setColumnHidden: () => {},
};

export const ColumnConfigContext = createContext<ColumnConfigContextValue>(defaultValue);

export function useColumnConfig(): ColumnConfigContextValue {
  return useContext(ColumnConfigContext);
}
