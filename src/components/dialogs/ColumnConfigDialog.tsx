/**
 * ColumnConfigDialog — Modal for configuring column order, visibility,
 * display names, and per-column flags.
 *
 * Replaces the jQuery UI dialog from `wcdatavis/src/ui/windows/col_config.js`.
 * Uses @dnd-kit for sortable row reordering.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@mieweb/ui/components/Modal';
import { Button } from '@mieweb/ui/components/Button';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation } from 'react-i18next';
import { DoubleChevronGlyphIcon, DragHandleIcon, IconButton } from '../ui';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface ColumnConfig {
  /** Field name (unique key) */
  field: string;
  /** Display name shown in the column header */
  displayText: string;
  /** Whether the column is pinned (frozen) */
  isPinned: boolean;
  /** Whether the column is hidden */
  isHidden: boolean;
  /** Allow raw HTML rendering in cells */
  allowHtml: boolean;
  /** Allow type-based formatting */
  allowFormatting: boolean;
  /** Whether the column can be hidden (some columns are required) */
  canHide?: boolean;
}

export interface ColumnConfigDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Current column configurations (ordered) */
  columns: ColumnConfig[];
  /** Called with updated column configs on save */
  onSave: (columns: ColumnConfig[], clearRenderCache: string[]) => void;
}

// ───────────────────────────────────────────────────────────
// Sortable Row
// ───────────────────────────────────────────────────────────

interface SortableRowProps {
  column: ColumnConfig;
  onToggle: (field: string, prop: keyof ColumnConfig) => void;
  onMoveToTop: (field: string) => void;
  onMoveToBottom: (field: string) => void;
}

function SortableRow({
  column,
  onToggle,
  onMoveToTop,
  onMoveToBottom,
}: SortableRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.field });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800">
      {/* Drag handle */}
      <td className="px-2 py-1.5 w-8 cursor-grab text-gray-400 dark:text-neutral-500" {...attributes} {...listeners}>
        <span aria-label={t('COL_CONFIG.DRAG_HANDLE')}><DragHandleIcon className="h-4 w-4" /></span>
      </td>

      {/* Field name */}
      <td className="px-2 py-1.5 text-sm font-mono text-gray-500 dark:text-neutral-400">{column.field}</td>

      {/* Display name */}
      <td className="px-2 py-1.5 text-sm">
        {column.displayText}
      </td>

      {/* Hidden */}
      <td className="px-2 py-1.5 text-center">
        <Tooltip content={t('COL_CONFIG.HIDE') || 'Hide column'}>
          <Checkbox
            checked={column.isHidden}
            disabled={column.canHide === false}
            onChange={() => onToggle(column.field, 'isHidden')}
            aria-label={t('COL_CONFIG.HIDE')}
          />
        </Tooltip>
      </td>

      {/* Pin */}
      <td className="px-2 py-1.5 text-center">
        <Tooltip content={column.isPinned ? (t('TABLE.UNPIN_COLUMN') || 'Unpin Column') : (t('TABLE.PIN_COLUMN') || 'Pin Column')}>
          <Checkbox
            checked={column.isPinned}
            onChange={() => onToggle(column.field, 'isPinned')}
            aria-label={t('COL_CONFIG.PIN') || 'Pin'}
          />
        </Tooltip>
      </td>

      {/* Allow HTML */}
      <td className="px-2 py-1.5 text-center">
        <Tooltip content={t('COL_CONFIG.ALLOW_HTML') || 'Allow HTML'}>
          <Checkbox
            checked={column.allowHtml}
            onChange={() => onToggle(column.field, 'allowHtml')}
            aria-label={t('COL_CONFIG.ALLOW_HTML')}
          />
        </Tooltip>
      </td>

      {/* Allow Formatting */}
      <td className="px-2 py-1.5 text-center">
        <Tooltip content={t('COL_CONFIG.ALLOW_FORMATTING') || 'Allow formatting'}>
          <Checkbox
            checked={column.allowFormatting}
            onChange={() => onToggle(column.field, 'allowFormatting')}
            aria-label={t('COL_CONFIG.ALLOW_FORMATTING')}
          />
        </Tooltip>
      </td>

      {/* Move buttons */}
      <td className="px-2 py-1.5 text-center whitespace-nowrap">
        <Tooltip content={t('COL_CONFIG.MOVE_TOP') || 'Move to top'}>
          <IconButton
            className="h-6 w-6 text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300"
            onClick={() => onMoveToTop(column.field)}
            aria-label={t('COL_CONFIG.MOVE_TOP')}
          >
            <DoubleChevronGlyphIcon className="h-4 w-4" direction="up" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t('COL_CONFIG.MOVE_BOTTOM') || 'Move to bottom'}>
          <IconButton
            className="h-6 w-6 text-gray-400 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300"
            onClick={() => onMoveToBottom(column.field)}
            aria-label={t('COL_CONFIG.MOVE_BOTTOM')}
          >
            <DoubleChevronGlyphIcon className="h-4 w-4" direction="down" />
          </IconButton>
        </Tooltip>
      </td>
    </tr>
  );
}

// ───────────────────────────────────────────────────────────
// Main Dialog
// ───────────────────────────────────────────────────────────

export function ColumnConfigDialog({
  open,
  onOpenChange,
  columns: initialColumns,
  onSave,
}: ColumnConfigDialogProps) {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [clearRenderCache, setClearRenderCache] = useState<Set<string>>(new Set());

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setColumns(initialColumns.map((c) => ({ ...c })));
        setClearRenderCache(new Set());
      }
      onOpenChange(isOpen);
    },
    [initialColumns, onOpenChange],
  );

  // Re-sync when initialColumns change and dialog is open
  useMemo(() => {
    if (open) {
      setColumns(initialColumns.map((c) => ({ ...c })));
      setClearRenderCache(new Set());
    }
  }, [open, initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fieldIds = useMemo(() => columns.map((c) => c.field), [columns]);

  // ── Handlers ──────────────────────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((prev) => {
        const oldIndex = prev.findIndex((c) => c.field === active.id);
        const newIndex = prev.findIndex((c) => c.field === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggle = useCallback((field: string, prop: keyof ColumnConfig) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.field !== field) return c;
        const updated = { ...c, [prop]: !c[prop] };
        if (prop === 'allowFormatting') {
          setClearRenderCache((s) => new Set(s).add(field));
        }
        return updated;
      }),
    );
  }, []);

  const handleMoveToTop = useCallback((field: string) => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.field === field);
      if (idx <= 0) return prev;
      return arrayMove(prev, idx, 0);
    });
  }, []);

  const handleMoveToBottom = useCallback((field: string) => {
    setColumns((prev) => {
      const idx = prev.findIndex((c) => c.field === field);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      return arrayMove(prev, idx, prev.length - 1);
    });
  }, []);

  const handleReset = useCallback(() => {
    setColumns(initialColumns.map((c) => ({ ...c })));
    setClearRenderCache(new Set());
  }, [initialColumns]);

  const handleSave = useCallback(() => {
    onSave(columns, Array.from(clearRenderCache));
    onOpenChange(false);
  }, [columns, clearRenderCache, onSave, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      size="xl"
      aria-label={t('COL_CONFIG.TITLE') || 'Column Configuration'}
    >
      <ModalHeader>
        <ModalTitle>{t('COL_CONFIG.TITLE') || 'Column Configuration'}</ModalTitle>
        <ModalClose />
      </ModalHeader>

      <ModalBody>
        {/* Sortable table */}
        <div className="max-h-[50vh] overflow-auto border rounded">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
              <table className="w-full text-sm" role="grid" aria-label={t('COL_CONFIG.TABLE_LABEL') || 'Column configuration table'}>
                <thead className="bg-gray-50 dark:bg-neutral-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 w-8" />
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.FIELD') || 'Field'}
                    </th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.DISPLAY_NAME') || 'Display Name'}
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.HIDE') || 'Hide'}
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.PIN') || 'Pin'}
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.HTML') || 'HTML'}
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.FORMAT') || 'Format'}
                    </th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-neutral-400">
                      {t('COL_CONFIG.MOVE') || 'Move'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <SortableRow
                      key={col.field}
                      column={col}
                      onToggle={handleToggle}
                      onMoveToTop={handleMoveToTop}
                      onMoveToBottom={handleMoveToBottom}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleReset} aria-label={t('COL_CONFIG.RESET') || 'Reset'}>
          {t('COL_CONFIG.RESET') || 'Reset'}
        </Button>
        <span className="flex-1" />
        <Button variant="outline" onClick={handleCancel}>
          {t('COMMON.CANCEL') || 'Cancel'}
        </Button>
        <Button onClick={handleSave}>
          {t('COMMON.OK') || 'OK'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
