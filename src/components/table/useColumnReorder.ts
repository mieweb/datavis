/**
 * useColumnReorder — Hook for column reorder via @dnd-kit.
 *
 * Replaces the legacy jQuery UI draggable/droppable column reorder
 * with a @dnd-kit sortable pattern for table header cells.
 */

import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { TableColumn } from './types';

export function useColumnReorder(
  columns: TableColumn[],
  onReorder?: (fromIndex: number, toIndex: number) => void,
) {
  const columnIds = columns.map((c) => c.field);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = columnIds.indexOf(active.id as string);
      const newIndex = columnIds.indexOf(over.id as string);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder?.(oldIndex, newIndex);
      }
    },
    [columnIds, onReorder],
  );

  const reorderColumns = useCallback(
    (fromIndex: number, toIndex: number): TableColumn[] => {
      return arrayMove(columns, fromIndex, toIndex);
    },
    [columns],
  );

  return { handleDragEnd, reorderColumns, columnIds };
}
