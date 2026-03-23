/**
 * ControlSection — a single section within the control panel
 * (e.g. Group, Pivot, Aggregate, or Filter).
 *
 * Contains a field dropdown to add new fields and a sortable list of
 * added fields (FieldPill instances).
 */

import { useCallback, useState, type ReactNode } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@mieweb/ui/components/Button';
import { Dropdown, DropdownContent } from '@mieweb/ui/components/Dropdown';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation } from 'react-i18next';
import { FieldPill } from './FieldPill';
import { ChevronGlyphIcon, CloseGlyphIcon, MenuAction } from '../ui';

export interface ControlFieldItem {
  /** Field name (key in data) */
  field: string;
  /** Display name */
  displayName: string;
  /** Optional subtitle (e.g. group function label) */
  subtitle?: string;
}

export interface AvailableField {
  /** Field name */
  field: string;
  /** Display name */
  displayName: string;
  /** Whether the field supports this control type */
  disabled?: boolean;
}

export interface ControlSectionProps {
  /** Section title */
  title: string;
  /** Icon for the section header */
  icon?: ReactNode;
  /** Currently added fields */
  fields: ControlFieldItem[];
  /** All available fields to add */
  availableFields: AvailableField[];
  /** Called when a field is added */
  onAdd: (field: string) => void;
  /** Called when a field is removed */
  onRemove: (field: string) => void;
  /** Called when fields are reordered: receives new ordered list */
  onReorder?: (fields: string[]) => void;
  /** Called to clear all fields */
  onClear: () => void;
  /** Called when user clicks the group-function button on a pill */
  onFunctionClick?: (field: string) => void;
  /** Whether to show the group-function button on pills */
  showFunctionButton?: boolean;
}

export function ControlSection({
  title,
  icon,
  fields,
  availableFields,
  onAdd,
  onRemove,
  onClear,
  onFunctionClick,
  showFunctionButton = false,
}: ControlSectionProps) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  // Filter out already-added fields from dropdown options
  const addedFieldNames = new Set(fields.map((f) => f.field));
  const dropdownOptions = availableFields.filter(
    (f) => !addedFieldNames.has(f.field),
  );

  const handleAdd = useCallback(
    (value: string) => {
      if (!value) return;
      onAdd(value);
      setAddOpen(false);
    },
    [onAdd],
  );

  const fieldIds = fields.map((f) => f.field);

  return (
    <div
      className="wcdv-control-section flex flex-col gap-1"
      role="region"
      aria-label={title}
    >
      {/* Section header */}
      <div className="flex items-center gap-1">
        {icon ? <span className="text-sm text-gray-500 dark:text-neutral-400" aria-hidden="true">{icon}</span> : null}
        <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300 uppercase tracking-wide">
          {title}
        </span>
        {fields.length > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-neutral-500">({fields.length})</span>
        )}
        <div className="flex-1" />
        {fields.length > 0 && (
          <Tooltip content={t('CONTROL.CLEAR') || 'Clear all'}>
            <Button
              size="sm"
              variant="ghost"
              className="!h-5 !px-1 text-xs text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400"
              onClick={onClear}
              aria-label={`${t('CONTROL.CLEAR')} ${title}`}
            >
              <CloseGlyphIcon className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Add field dropdown */}
      {dropdownOptions.length > 0 && (
        <Dropdown
          open={addOpen}
          onOpenChange={setAddOpen}
          placement="bottom-start"
          width="trigger"
          searchable
          searchPlaceholder={t('FILTER.SEARCH', { defaultValue: 'Search…' })}
          searchAriaLabel={t('CONTROL.SEARCH_FIELDS', { defaultValue: `Search ${title} fields` })}
          searchEmptyState={(
            <div className="px-3 py-2 text-xs italic text-gray-400">
              {t('CONTROL.NO_FIELDS', { defaultValue: 'No fields found' })}
            </div>
          )}
          trigger={(
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full justify-between gap-2 text-xs font-normal"
              aria-label={`${t('CONTROL.ADD_FIELD') || 'Add field'} — ${title}`}
            >
              <span className="truncate">{t('CONTROL.ADD_FIELD') || '+ Add field…'}</span>
              <ChevronGlyphIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" direction="down" />
            </Button>
          )}
        >
          <DropdownContent className="max-h-60 overflow-auto py-1">
            {dropdownOptions.map((fieldOption) => (
              <MenuAction
                key={fieldOption.field}
                disabled={fieldOption.disabled}
                searchText={`${fieldOption.displayName} ${fieldOption.field}`}
                onClick={() => handleAdd(fieldOption.field)}
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate">{fieldOption.displayName}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
                    {fieldOption.field}
                  </span>
                </span>
              </MenuAction>
            ))}
          </DropdownContent>
        </Dropdown>
      )}

      {/* Sortable field list */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1" role="list" aria-label={t('CONTROL.SECTION_FIELDS', { param0: title }) || `${title} fields`}>
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            {fields.map((f) => (
              <FieldPill
                key={f.field}
                id={f.field}
                label={f.displayName}
                subtitle={f.subtitle}
                onRemove={onRemove}
                onFunctionClick={onFunctionClick}
                showFunctionButton={showFunctionButton}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
