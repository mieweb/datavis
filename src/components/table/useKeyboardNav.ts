/**
 * useKeyboardNav — Hook for keyboard navigation in the table.
 *
 * Supports j/k for row navigation, Enter for row activation,
 * and arrow keys for cell navigation.
 */

import { useCallback } from 'react';
import type { TableRow, SelectionState } from './types';

export function useKeyboardNav(
  rows: TableRow[],
  selection: SelectionState,
  onSelectionChange?: (selection: SelectionState) => void,
  onRowClick?: (row: TableRow, event: React.KeyboardEvent) => void,
) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (rows.length === 0) return;

      const { activeRow } = selection;
      let nextRow: number | null = null;

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          event.preventDefault();
          if (activeRow === null) {
            nextRow = rows[0]?.rowNum ?? null;
          } else {
            const idx = rows.findIndex((r) => r.rowNum === activeRow);
            if (idx < rows.length - 1) {
              nextRow = rows[idx + 1].rowNum;
            }
          }
          break;

        case 'k':
        case 'ArrowUp':
          event.preventDefault();
          if (activeRow === null) {
            nextRow = rows[rows.length - 1]?.rowNum ?? null;
          } else {
            const idx = rows.findIndex((r) => r.rowNum === activeRow);
            if (idx > 0) {
              nextRow = rows[idx - 1].rowNum;
            }
          }
          break;

        case 'Enter':
        case ' ':
          if (activeRow !== null) {
            event.preventDefault();
            const row = rows.find((r) => r.rowNum === activeRow);
            if (row) {
              onRowClick?.(row, event);
            }
          }
          break;

        case 'Home':
          event.preventDefault();
          nextRow = rows[0]?.rowNum ?? null;
          break;

        case 'End':
          event.preventDefault();
          nextRow = rows[rows.length - 1]?.rowNum ?? null;
          break;

        default:
          return;
      }

      if (nextRow !== null && nextRow !== activeRow) {
        const newSelection: SelectionState = {
          ...selection,
          activeRow: nextRow,
          selectedRows: event.shiftKey
            ? new Set([...selection.selectedRows, nextRow])
            : new Set([nextRow]),
        };
        onSelectionChange?.(newSelection);
      }
    },
    [rows, selection, onSelectionChange, onRowClick],
  );

  return { handleKeyDown };
}
