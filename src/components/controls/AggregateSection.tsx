/**
 * AggregateSection — aggregate control for the control panel.
 *
 * Unlike Group/Pivot sections, aggregates have a function selector
 * and potentially multiple field arguments per aggregate entry.
 */

import { useState, useCallback } from 'react';
import { Select } from '@mieweb/ui/components/Select';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { Switch } from '@mieweb/ui/components/Switch';
import { useTranslation } from 'react-i18next';
import { ClipboardIcon, CloseGlyphIcon } from '../ui';
import { COLUMN_DRAG_MIME } from './column-drag';

export interface AggregateFunction {
  /** Function name (key) */
  name: string;
  /** Display label */
  label: string;
  /** Number of field arguments this function takes */
  fieldCount: number;
}

export interface AggregateEntry {
  /** Unique ID */
  id: string;
  /** Aggregate function name */
  functionName: string;
  /** Field arguments */
  fields: string[];
  /** Whether this aggregate is visible */
  visible: boolean;
}

export interface AvailableField {
  field: string;
  displayName: string;
}

export interface AggregateSectionProps {
  /** Available aggregate functions */
  functions: AggregateFunction[];
  /** Current aggregate entries */
  entries: AggregateEntry[];
  /** Available fields to use as arguments */
  availableFields: AvailableField[];
  /** Called when entries change */
  onChange: (entries: AggregateEntry[]) => void;
}

export function AggregateSection({
  functions,
  entries,
  availableFields,
  onChange,
}: AggregateSectionProps) {
  const { t } = useTranslation();
  const [addingFn, setAddingFn] = useState('');

  const handleAddFunction = useCallback(
    (fnName: string) => {
      const fn = functions.find((f) => f.name === fnName);
      if (!fn) return;
      const newEntry: AggregateEntry = {
        id: `agg-${Date.now()}`,
        functionName: fnName,
        fields: new Array(fn.fieldCount).fill(''),
        visible: true,
      };
      onChange([...entries, newEntry]);
      setAddingFn('');
    },
    [functions, entries, onChange],
  );

  const handleRemove = useCallback(
    (id: string) => {
      onChange(entries.filter((e) => e.id !== id));
    },
    [entries, onChange],
  );

  const handleFieldChange = useCallback(
    (id: string, fieldIndex: number, value: string) => {
      onChange(
        entries.map((e) =>
          e.id === id
            ? { ...e, fields: e.fields.map((f, i) => (i === fieldIndex ? value : f)) }
            : e,
        ),
      );
    },
    [entries, onChange],
  );

  const handleVisibilityChange = useCallback(
    (id: string, visible: boolean) => {
      onChange(entries.map((e) => (e.id === id ? { ...e, visible } : e)));
    },
    [entries, onChange],
  );

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  // ── Column drop zone — dropping a header creates an aggregate for it ──
  const [dragOver, setDragOver] = useState(false);

  const handleNativeDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(COLUMN_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleNativeDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleNativeDrop = useCallback(
    (e: React.DragEvent) => {
      setDragOver(false);
      const field = e.dataTransfer.getData(COLUMN_DRAG_MIME);
      if (!field) return;
      e.preventDefault();
      if (!availableFields.some((f) => f.field === field)) return;
      // Prefer sum(); fall back to the first single-field function
      const fn =
        functions.find((f) => f.name === 'sum' && f.fieldCount === 1) ??
        functions.find((f) => f.fieldCount === 1);
      if (!fn) return;
      const fields = new Array<string>(fn.fieldCount).fill('');
      fields[0] = field;
      onChange([
        ...entries,
        { id: `agg-${Date.now()}`, functionName: fn.name, fields, visible: true },
      ]);
    },
    [availableFields, functions, entries, onChange],
  );

  const fieldOptions = availableFields.map((f) => ({
    value: f.field,
    label: f.displayName,
  }));

  const fnOptions = functions.map((f) => ({
    value: f.name,
    label: t(f.label),
  }));

  return (
    <fieldset
      className={`wcdv-control-section wcdv-aggregate-section flex flex-col gap-1 rounded transition-colors border-0 p-0 m-0 min-w-0 ${
        dragOver ? 'ring-2 ring-primary-400 dark:ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''
      }`}
      aria-label={t('CONTROL.AGGREGATE') || 'Aggregate'}
      data-drop-zone="aggregate"
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      {/* Header */}
      <legend className="flex items-center gap-1 w-full">
        <span className="text-sm text-muted-foreground" aria-hidden="true"><ClipboardIcon className="h-4 w-4" /></span>
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {t('CONTROL.AGGREGATE') || 'Aggregate'}
        </span>
        {entries.length > 0 && (
          <span className="text-[10px] text-muted-foreground">({entries.length})</span>
        )}
        <div className="flex-1" />
        {entries.length > 0 && (
          <Tooltip content={t('CONTROL.CLEAR') || 'Clear all'}>
            <Button
              size="sm"
              variant="ghost"
              className="!h-5 !px-1 text-xs text-muted-foreground hover:text-destructive-500 dark:hover:text-destructive-400"
              onClick={handleClear}
              aria-label={`${t('CONTROL.CLEAR')} aggregate`}
            >
              <CloseGlyphIcon className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
      </legend>

      {/* Add function dropdown */}
      <Select
        size="sm"
        hideLabel
        label={t('CONTROL.ADD_AGGREGATE') || 'Add aggregate function'}
        placeholder={t('CONTROL.ADD_AGGREGATE') || '+ Add aggregate…'}
        options={fnOptions}
        value={addingFn}
        onValueChange={handleAddFunction}
      />

      {/* Entries */}
      {entries.map((entry) => {
        const fn = functions.find((f) => f.name === entry.functionName);
        return (
          <div
            key={entry.id}
            className="wcdv-aggregate-entry flex items-center gap-1 bg-card border border-border rounded px-2 py-1"
          >
            <Switch
              size="sm"
              checked={entry.visible}
              onCheckedChange={(checked) =>
                handleVisibilityChange(entry.id, checked)
              }
              label={t('CONTROL.VISIBLE') || 'Visible'}
              aria-label={t('CONTROL.VISIBLE') || 'Visible'}
            />
            <span className="text-xs font-medium text-muted-foreground min-w-[50px]">
              {fn ? t(fn.label) : entry.functionName}
            </span>
            {entry.fields.map((fieldVal, idx) => (
              <Select
                key={idx}
                size="sm"
                hideLabel
                label={`${fn ? t(fn.label) : entry.functionName} field ${idx + 1}`}
                placeholder={t('CONTROL.SELECT_FIELD') || 'Field…'}
                options={fieldOptions}
                value={fieldVal}
                onValueChange={(val) =>
                  handleFieldChange(entry.id, idx, val)
                }
              />
            ))}
            <Tooltip content={t('CONTROL.REMOVE') || 'Remove'}>
              <Button
                size="sm"
                variant="ghost"
                className="!p-0 !min-w-0 !h-4 !w-4 text-muted-foreground hover:text-destructive-500 dark:hover:text-destructive-400"
                onClick={() => handleRemove(entry.id)}
                aria-label={`${t('CONTROL.REMOVE')} ${fn ? t(fn.label) : entry.functionName}`}
              >
                <CloseGlyphIcon className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </fieldset>
  );
}
