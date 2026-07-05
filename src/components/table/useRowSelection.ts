/**
 * useRowSelection — pure helpers + hook for table row selection.
 *
 * Powers `features.rowSelection`:
 * - `true` — click selects, Shift+click extends (legacy behavior)
 * - `'checkbox'` — leading checkbox column; individual toggles accumulate and
 *   a tri-state header checkbox selects/clears every *currently rendered*
 *   (i.e. filtered) row.
 */

import { useCallback, useMemo, useState } from 'react';
import type { SelectionState, TableRow } from './types';

/** Tri-state of the header select-all checkbox. */
export type HeaderCheckState = 'none' | 'some' | 'all';

/** Compute the header checkbox state for the rows currently rendered. */
export function headerCheckState(
  selectedRows: Set<number>,
  rows: Pick<TableRow, 'rowNum'>[],
): HeaderCheckState {
  if (rows.length === 0 || selectedRows.size === 0) return 'none';
  let selected = 0;
  for (const row of rows) {
    if (selectedRows.has(row.rowNum)) selected += 1;
  }
  if (selected === 0) return 'none';
  return selected === rows.length ? 'all' : 'some';
}

/** Toggle one row number in the selection (accumulative). */
export function toggleRowSelection(
  selection: SelectionState,
  rowNum: number,
): SelectionState {
  const selectedRows = new Set(selection.selectedRows);
  if (selectedRows.has(rowNum)) selectedRows.delete(rowNum);
  else selectedRows.add(rowNum);
  return { ...selection, activeRow: rowNum, selectedRows };
}

/**
 * Header checkbox action: if every rendered row is selected, clear them all;
 * otherwise select every rendered (filtered) row. Selections of rows that are
 * no longer rendered (filtered out) are preserved.
 */
export function toggleAllRows(
  selection: SelectionState,
  rows: Pick<TableRow, 'rowNum'>[],
): SelectionState {
  const selectedRows = new Set(selection.selectedRows);
  const state = headerCheckState(selection.selectedRows, rows);
  if (state === 'all') {
    for (const row of rows) selectedRows.delete(row.rowNum);
  } else {
    for (const row of rows) selectedRows.add(row.rowNum);
  }
  return { ...selection, selectedRows };
}

export interface UseRowSelectionResult {
  selection: SelectionState;
  setSelection: (sel: SelectionState) => void;
  /** Tri-state of the header select-all checkbox */
  headerState: HeaderCheckState;
  /** Toggle a single row's checkbox */
  toggleRow: (rowNum: number) => void;
  /** Toggle the header select-all checkbox */
  toggleAll: () => void;
}

/** Selection state + checkbox-column handlers for a rendered row set. */
export function useRowSelection(
  rows: Pick<TableRow, 'rowNum'>[],
  onSelectionChange?: (selection: SelectionState) => void,
): UseRowSelectionResult {
  const [selection, setSelectionState] = useState<SelectionState>({
    selectedRows: new Set(),
    activeRow: null,
    activeColumn: null,
  });

  const setSelection = useCallback(
    (sel: SelectionState) => {
      setSelectionState(sel);
      onSelectionChange?.(sel);
    },
    [onSelectionChange],
  );

  const headerState = useMemo(
    () => headerCheckState(selection.selectedRows, rows),
    [selection.selectedRows, rows],
  );

  const toggleRow = useCallback(
    (rowNum: number) => setSelection(toggleRowSelection(selection, rowNum)),
    [selection, setSelection],
  );

  const toggleAll = useCallback(
    () => setSelection(toggleAllRows(selection, rows)),
    [selection, rows, setSelection],
  );

  return { selection, setSelection, headerState, toggleRow, toggleAll };
}
