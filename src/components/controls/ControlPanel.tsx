/**
 * ControlPanel — composite control panel replacing the legacy GridControl.
 *
 * Contains four sections: Filter, Group, Pivot, Aggregate.
 * Uses @dnd-kit for field reordering within Group and Pivot sections.
 */

import { useCallback, useMemo } from 'react';
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

import { ControlSection, type ControlFieldItem, type AvailableField } from './ControlSection';
import { AggregateSection, type AggregateFunction, type AggregateEntry } from './AggregateSection';
import { FilterBar } from '../filters/FilterBar';
import { useTranslation, type TransFn } from '../../i18n';
import type { ColumnFilterConfig, FilterSpec } from '../filters/types';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface ControlPanelProps {
  /** Column configs for filters */
  filterColumns: ColumnFilterConfig[];
  /** All columns available for adding to the filter bar */
  allFilterableFields?: { field: string; displayName: string }[];
  /** Available fields for group/pivot */
  availableFields: AvailableField[];
  /** Available fields for aggregate */
  aggregateFields: AvailableField[];

  /** Current group fields */
  groupFields: ControlFieldItem[];
  /** Current pivot fields */
  pivotFields: ControlFieldItem[];
  /** Current aggregate entries */
  aggregateEntries: AggregateEntry[];
  /** Available aggregate functions */
  aggregateFunctions: AggregateFunction[];

  /** Initial filter spec (restored from prefs) */
  initialFilterSpec?: FilterSpec;

  /** Handlers */
  onFilterChange: (spec: FilterSpec) => void;
  onRemoveFilterColumn?: (field: string) => void;
  onAddFilterColumn?: (field: string) => void;
  onGroupChange: (fields: string[]) => void;
  onPivotChange: (fields: string[]) => void;
  onAggregateChange: (entries: AggregateEntry[]) => void;
  /** Called when user clicks the group-function button on a group pill */
  onGroupFunctionClick?: (field: string) => void;
  /** Called when user clicks the group-function button on a pivot pill */
  onPivotFunctionClick?: (field: string) => void;

  /** i18n */
  trans?: TransFn;
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function ControlPanel({
  filterColumns,
  allFilterableFields,
  availableFields,
  aggregateFields,
  groupFields,
  pivotFields,
  aggregateEntries,
  aggregateFunctions,
  initialFilterSpec,
  onFilterChange,
  onRemoveFilterColumn,
  onAddFilterColumn,
  onGroupChange,
  onPivotChange,
  onAggregateChange,
  onGroupFunctionClick,
  onPivotFunctionClick,
  trans: transProp,
}: ControlPanelProps) {
  const t = useTranslation(transProp);
  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Group handlers ──
  const handleGroupAdd = useCallback(
    (field: string) => {
      const newFields = [...groupFields.map((f) => f.field), field];
      onGroupChange(newFields);
    },
    [groupFields, onGroupChange],
  );

  const handleGroupRemove = useCallback(
    (field: string) => {
      onGroupChange(groupFields.filter((f) => f.field !== field).map((f) => f.field));
    },
    [groupFields, onGroupChange],
  );

  const handleGroupClear = useCallback(() => {
    onGroupChange([]);
  }, [onGroupChange]);

  // ── Pivot handlers ──
  const handlePivotAdd = useCallback(
    (field: string) => {
      const newFields = [...pivotFields.map((f) => f.field), field];
      onPivotChange(newFields);
    },
    [pivotFields, onPivotChange],
  );

  const handlePivotRemove = useCallback(
    (field: string) => {
      onPivotChange(pivotFields.filter((f) => f.field !== field).map((f) => f.field));
    },
    [pivotFields, onPivotChange],
  );

  const handlePivotClear = useCallback(() => {
    onPivotChange([]);
  }, [onPivotChange]);

  // ── DnD reorder for group and pivot ──
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Check if it's a group field
      const groupIdx = groupFields.findIndex((f) => f.field === active.id);
      if (groupIdx !== -1) {
        const overIdx = groupFields.findIndex((f) => f.field === over.id);
        if (overIdx !== -1) {
          const reordered = arrayMove(
            groupFields.map((f) => f.field),
            groupIdx,
            overIdx,
          );
          onGroupChange(reordered);
          return;
        }
      }

      // Check if it's a pivot field
      const pivotIdx = pivotFields.findIndex((f) => f.field === active.id);
      if (pivotIdx !== -1) {
        const overIdx = pivotFields.findIndex((f) => f.field === over.id);
        if (overIdx !== -1) {
          const reordered = arrayMove(
            pivotFields.map((f) => f.field),
            pivotIdx,
            overIdx,
          );
          onPivotChange(reordered);
        }
      }
    },
    [groupFields, pivotFields, onGroupChange, onPivotChange],
  );

  // ── Available fields filtering ──
  // Exclude currently-grouped fields from pivot options and vice versa
  const groupFieldNames = useMemo(
    () => new Set(groupFields.map((f) => f.field)),
    [groupFields],
  );
  const pivotFieldNames = useMemo(
    () => new Set(pivotFields.map((f) => f.field)),
    [pivotFields],
  );

  const groupAvailable: AvailableField[] = useMemo(
    () =>
      availableFields.map((f) => ({
        ...f,
        disabled: pivotFieldNames.has(f.field),
      })),
    [availableFields, pivotFieldNames],
  );

  const pivotAvailable: AvailableField[] = useMemo(
    () =>
      availableFields.map((f) => ({
        ...f,
        disabled: groupFieldNames.has(f.field),
      })),
    [availableFields, groupFieldNames],
  );

  return (
    <div
      className="wcdv-control-panel border-b border-gray-200 bg-gray-50"
      role="region"
      aria-label={t('CONTROL.TITLE') || 'Controls'}
    >
      {/* Filter Bar */}
      {(filterColumns.length > 0 || (allFilterableFields && allFilterableFields.length > 0)) && (
        <FilterBar
          columns={filterColumns}
          initialSpec={initialFilterSpec}
          onFilterChange={onFilterChange}
          onRemoveColumn={onRemoveFilterColumn}
          availableFields={allFilterableFields}
          onAddColumn={onAddFilterColumn}
        />
      )}

      {/* Group / Pivot / Aggregate sections */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2">
          {/* Group */}
          <ControlSection
            title={t('CONTROL.GROUP') || 'Group'}
            icon="🔢"
            fields={groupFields}
            availableFields={groupAvailable}
            onAdd={handleGroupAdd}
            onRemove={handleGroupRemove}
            onClear={handleGroupClear}
            onFunctionClick={onGroupFunctionClick}
            showFunctionButton={true}
          />

          {/* Pivot */}
          <ControlSection
            title={t('CONTROL.PIVOT') || 'Pivot'}
            icon="🔄"
            fields={pivotFields}
            availableFields={pivotAvailable}
            onAdd={handlePivotAdd}
            onRemove={handlePivotRemove}
            onClear={handlePivotClear}
            onFunctionClick={onPivotFunctionClick}
            showFunctionButton={true}
          />

          {/* Aggregate */}
          <AggregateSection
            functions={aggregateFunctions}
            entries={aggregateEntries}
            availableFields={aggregateFields.map((f) => ({
              field: f.field,
              displayName: f.displayName,
            }))}
            onChange={onAggregateChange}
          />
        </div>
      </DndContext>
    </div>
  );
}
