/**
 * FieldPill — a draggable field chip used in control panel sections.
 *
 * Shows the field display name with a remove button. Can be reordered
 * within its parent list via @dnd-kit/sortable. Optionally shows a
 * "bolt" button for selecting a group function.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation } from 'react-i18next';
import { CloseGlyphIcon, DragHandleIcon, SettingsIcon } from '../ui';

export interface FieldPillProps {
  /** Unique ID for DnD */
  id: string;
  /** Display label */
  label: string;
  /** Optional subtitle (e.g. group function) */
  subtitle?: string;
  /** Remove handler */
  onRemove: (id: string) => void;
  /** Called when the user clicks the group-function button (bolt icon) */
  onFunctionClick?: (id: string) => void;
  /** Whether to show the group function button */
  showFunctionButton?: boolean;
}

export function FieldPill({
  id,
  label,
  subtitle,
  onRemove,
  onFunctionClick,
  showFunctionButton = false,
}: FieldPillProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`wcdv-field-pill inline-flex items-center gap-1 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 rounded px-2 py-0.5 text-xs shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-blue-300 dark:ring-blue-600' : ''
      }`}
      aria-label={`${label}${subtitle ? ` (${subtitle})` : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="text-gray-400 dark:text-neutral-500 select-none" aria-hidden="true"><DragHandleIcon className="h-3.5 w-3.5" /></span>
      <span className="truncate max-w-[120px]">{label}</span>
      {subtitle && (
        <span className="text-blue-500 dark:text-blue-400 text-[10px] font-medium">({subtitle})</span>
      )}
      {showFunctionButton && (
        <Tooltip content={t('CONTROL.GROUP_FUNCTION') || 'Group function'}>
          <Button
            size="sm"
            variant="ghost"
            className={`!p-0 !min-w-0 !h-4 !w-4 ${subtitle ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-neutral-500'} hover:text-blue-600 dark:hover:text-blue-400`}
            onClick={(e) => {
              e.stopPropagation();
              onFunctionClick?.(id);
            }}
            aria-label={`${t('CONTROL.GROUP_FUNCTION') || 'Group function'} ${label}`}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      <Tooltip content={t('CONTROL.REMOVE_FIELD') || 'Remove'}>
        <Button
          size="sm"
          variant="ghost"
          className="!p-0 !min-w-0 !h-4 !w-4 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          aria-label={`${t('CONTROL.REMOVE')} ${label}`}
        >
          <CloseGlyphIcon className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
    </div>
  );
}
