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
import { useTranslation, type TransFn } from '../../i18n';

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
  /** i18n */
  trans?: TransFn;
}

export function FieldPill({
  id,
  label,
  subtitle,
  onRemove,
  onFunctionClick,
  showFunctionButton = false,
  trans: transProp,
}: FieldPillProps) {
  const t = useTranslation(transProp);
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
      className={`wcdv-field-pill inline-flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-0.5 text-xs shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-blue-300' : ''
      }`}
      aria-label={`${label}${subtitle ? ` (${subtitle})` : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="text-gray-400 select-none" aria-hidden="true">⠿</span>
      <span className="truncate max-w-[120px]">{label}</span>
      {subtitle && (
        <span className="text-blue-500 text-[10px] font-medium">({subtitle})</span>
      )}
      {showFunctionButton && (
        <Tooltip content={t('CONTROL.GROUP_FUNCTION') || 'Group function'}>
          <Button
            size="sm"
            variant="ghost"
            className={`!p-0 !min-w-0 !h-4 !w-4 ${subtitle ? 'text-blue-500' : 'text-gray-400'} hover:text-blue-600`}
            onClick={(e) => {
              e.stopPropagation();
              onFunctionClick?.(id);
            }}
            aria-label={`${t('CONTROL.GROUP_FUNCTION') || 'Group function'} ${label}`}
          >
            ⚡
          </Button>
        </Tooltip>
      )}
      <Tooltip content={t('CONTROL.REMOVE_FIELD') || 'Remove'}>
        <Button
          size="sm"
          variant="ghost"
          className="!p-0 !min-w-0 !h-4 !w-4 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          aria-label={`${t('CONTROL.REMOVE')} ${label}`}
        >
          ✕
        </Button>
      </Tooltip>
    </div>
  );
}
