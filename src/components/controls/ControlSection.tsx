/**
 * ControlSection — a single section within the control panel
 * (e.g. Group, Pivot, Aggregate, or Filter).
 *
 * Contains a field dropdown to add new fields and a sortable list of
 * added fields (FieldPill instances).
 */

import { useCallback } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Select } from '@mieweb/ui/components/Select';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { FieldPill } from './FieldPill';

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
  icon?: string;
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
  /** i18n */
  trans?: (key: string) => string;
}

export function ControlSection({
  title,
  icon,
  fields,
  availableFields,
  onAdd,
  onRemove,
  onClear,
  trans: t = (k) => k,
}: ControlSectionProps) {
  // Filter out already-added fields from dropdown options
  const addedFieldNames = new Set(fields.map((f) => f.field));
  const dropdownOptions = availableFields
    .filter((f) => !addedFieldNames.has(f.field))
    .map((f) => ({
      value: f.field,
      label: f.displayName,
      disabled: f.disabled,
    }));

  const handleAdd = useCallback(
    (value: string) => {
      if (value) onAdd(value);
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
        {icon && <span className="text-sm" aria-hidden="true">{icon}</span>}
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </span>
        {fields.length > 0 && (
          <span className="text-[10px] text-gray-400">({fields.length})</span>
        )}
        <div className="flex-1" />
        {fields.length > 0 && (
          <Tooltip content={t('CONTROL.CLEAR') || 'Clear all'}>
            <Button
              size="sm"
              variant="ghost"
              className="!h-5 !px-1 text-xs text-gray-400 hover:text-red-500"
              onClick={onClear}
              aria-label={`${t('CONTROL.CLEAR')} ${title}`}
            >
              ✕
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Add field dropdown */}
      {dropdownOptions.length > 0 && (
        <Select
          size="sm"
          hideLabel
          label={`${t('CONTROL.ADD_FIELD') || 'Add field'} — ${title}`}
          placeholder={t('CONTROL.ADD_FIELD') || '+ Add field…'}
          options={dropdownOptions}
          searchable={dropdownOptions.length > 8}
          onValueChange={handleAdd}
        />
      )}

      {/* Sortable field list */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1" role="list" aria-label={`${title} fields`}>
          <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
            {fields.map((f) => (
              <FieldPill
                key={f.field}
                id={f.field}
                label={f.displayName}
                subtitle={f.subtitle}
                onRemove={onRemove}
                trans={t}
              />
            ))}
          </SortableContext>
        </div>
      )}

      {/* Empty state */}
      {fields.length === 0 && (
        <div
          className="text-xs text-gray-400 italic px-2 py-1 border border-dashed border-gray-200 rounded text-center"
          role="status"
        >
          {t('CONTROL.DROP_HINT') || 'Add or drag fields here'}
        </div>
      )}
    </div>
  );
}
