/**
 * useKeyboardNav — Hook for keyboard navigation in the table.
 *
 * Supports j/k for row navigation, Enter for row activation,
 * arrow keys for cell navigation, PageUp/PageDown for fast scroll,
 * Escape to clear selection, and auto scroll-into-view.
 */

import { useCallback } from 'react';
import type { TableRow, SelectionState } from './types';

/** Number of rows to jump with PageUp / PageDown. */
const PAGE_SIZE = 10;

/**
 * Scroll the active row into view within the table container.
 */
function scrollActiveRowIntoView(rowNum: number) {
  // Defer to allow React to render the new selection state first
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-row-num="${rowNum}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

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

        case 'PageDown':
          event.preventDefault();
          if (activeRow === null) {
            nextRow = rows[0]?.rowNum ?? null;
          } else {
            const idx = rows.findIndex((r) => r.rowNum === activeRow);
            const target = Math.min(idx + PAGE_SIZE, rows.length - 1);
            nextRow = rows[target].rowNum;
          }
          break;

        case 'PageUp':
          event.preventDefault();
          if (activeRow === null) {
            nextRow = rows[rows.length - 1]?.rowNum ?? null;
          } else {
            const idx = rows.findIndex((r) => r.rowNum === activeRow);
            const target = Math.max(idx - PAGE_SIZE, 0);
            nextRow = rows[target].rowNum;
          }
          break;

        case 'Escape':
          event.preventDefault();
          onSelectionChange?.({
            ...selection,
            activeRow: null,
            selectedRows: new Set(),
          });
          return;

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
        scrollActiveRowIntoView(nextRow);
      }
    },
    [rows, selection, onSelectionChange, onRowClick],
  );

  return { handleKeyDown };
}
