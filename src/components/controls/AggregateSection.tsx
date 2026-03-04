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
  /** i18n */
  trans?: (key: string) => string;
}

export function AggregateSection({
  functions,
  entries,
  availableFields,
  onChange,
  trans: t = (k) => k,
}: AggregateSectionProps) {
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

  const fieldOptions = availableFields.map((f) => ({
    value: f.field,
    label: f.displayName,
  }));

  const fnOptions = functions.map((f) => ({
    value: f.name,
    label: f.label,
  }));

  return (
    <div
      className="wcdv-control-section wcdv-aggregate-section flex flex-col gap-1"
      role="region"
      aria-label={t('CONTROL.AGGREGATE') || 'Aggregate'}
    >
      {/* Header */}
      <div className="flex items-center gap-1">
        <span className="text-sm" aria-hidden="true">Σ</span>
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {t('CONTROL.AGGREGATE') || 'Aggregate'}
        </span>
        {entries.length > 0 && (
          <span className="text-[10px] text-gray-400">({entries.length})</span>
        )}
        <div className="flex-1" />
        {entries.length > 0 && (
          <Tooltip content={t('CONTROL.CLEAR') || 'Clear all'}>
            <Button
              size="sm"
              variant="ghost"
              className="!h-5 !px-1 text-xs text-gray-400 hover:text-red-500"
              onClick={handleClear}
              aria-label={`${t('CONTROL.CLEAR')} aggregate`}
            >
              ✕
            </Button>
          </Tooltip>
        )}
      </div>

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
            className="wcdv-aggregate-entry flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1"
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
            <span className="text-xs font-medium text-gray-600 min-w-[50px]">
              {fn?.label ?? entry.functionName}
            </span>
            {entry.fields.map((fieldVal, idx) => (
              <Select
                key={idx}
                size="sm"
                hideLabel
                label={`${fn?.label} field ${idx + 1}`}
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
                className="!p-0 !min-w-0 !h-4 !w-4 text-gray-400 hover:text-red-500"
                onClick={() => handleRemove(entry.id)}
                aria-label={`${t('CONTROL.REMOVE')} ${fn?.label}`}
              >
                ✕
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
