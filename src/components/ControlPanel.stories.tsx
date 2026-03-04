/**
 * ControlPanel.stories — Storybook stories for the control panel.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ControlPanel } from './controls/ControlPanel';
import type { ControlFieldItem } from './controls/ControlSection';
import type { AggregateEntry, AggregateFunction } from './controls/AggregateSection';
import type { ColumnFilterConfig, FilterSpec } from './filters/types';

const AVAILABLE_FIELDS = [
  { field: 'name', displayName: 'Name' },
  { field: 'department', displayName: 'Department' },
  { field: 'status', displayName: 'Status' },
  { field: 'region', displayName: 'Region' },
  { field: 'hire_date', displayName: 'Hire Date' },
];

const AGGREGATE_FIELDS = [
  { field: 'salary', displayName: 'Salary' },
  { field: 'age', displayName: 'Age' },
  { field: 'hours', displayName: 'Hours' },
];

const AGGREGATE_FUNCTIONS: AggregateFunction[] = [
  { name: 'sum', label: 'Sum', fieldCount: 1 },
  { name: 'avg', label: 'Average', fieldCount: 1 },
  { name: 'count', label: 'Count', fieldCount: 0 },
  { name: 'min', label: 'Min', fieldCount: 1 },
  { name: 'max', label: 'Max', fieldCount: 1 },
  { name: 'weightedAvg', label: 'Weighted Average', fieldCount: 2 },
];

const FILTER_COLUMNS: ColumnFilterConfig[] = [
  { field: 'name', displayName: 'Name', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'department', displayName: 'Department', filterType: 'string', widget: 'dropdown', options: ['Engineering', 'Marketing', 'Design'], visible: true },
  { field: 'salary', displayName: 'Salary', filterType: 'currency', visible: true },
  { field: 'hire_date', displayName: 'Hire Date', filterType: 'date', visible: true },
];

function ControlPanelWrapper() {
  const [filterSpec, setFilterSpec] = useState<FilterSpec>({});
  const [groupFields, setGroupFields] = useState<ControlFieldItem[]>([]);
  const [pivotFields, setPivotFields] = useState<ControlFieldItem[]>([]);
  const [aggEntries, setAggEntries] = useState<AggregateEntry[]>([]);

  const handleGroupChange = (fields: string[]) => {
    setGroupFields(
      fields.map((f) => ({
        field: f,
        displayName: AVAILABLE_FIELDS.find((af) => af.field === f)?.displayName ?? f,
      })),
    );
  };

  const handlePivotChange = (fields: string[]) => {
    setPivotFields(
      fields.map((f) => ({
        field: f,
        displayName: AVAILABLE_FIELDS.find((af) => af.field === f)?.displayName ?? f,
      })),
    );
  };

  return (
    <div className="max-w-5xl border rounded-lg overflow-hidden">
      <ControlPanel
        filterColumns={FILTER_COLUMNS}
        availableFields={AVAILABLE_FIELDS}
        aggregateFields={AGGREGATE_FIELDS}
        groupFields={groupFields}
        pivotFields={pivotFields}
        aggregateEntries={aggEntries}
        aggregateFunctions={AGGREGATE_FUNCTIONS}
        onFilterChange={setFilterSpec}
        onGroupChange={handleGroupChange}
        onPivotChange={handlePivotChange}
        onAggregateChange={setAggEntries}
      />
      <pre className="p-3 bg-gray-100 text-xs overflow-auto">
        {JSON.stringify({ filterSpec, groupFields: groupFields.map((f) => f.field), pivotFields: pivotFields.map((f) => f.field), aggEntries }, null, 2)}
      </pre>
    </div>
  );
}

const meta: Meta = {
  title: 'DataVis/ControlPanel',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ControlPanelWrapper />,
};

export const WithGroupFields: Story = {
  render: () => {
    const [groupFields, setGroupFields] = useState<ControlFieldItem[]>([
      { field: 'department', displayName: 'Department' },
      { field: 'region', displayName: 'Region' },
    ]);
    const [pivotFields, setPivotFields] = useState<ControlFieldItem[]>([]);
    const [aggEntries, setAggEntries] = useState<AggregateEntry[]>([
      { id: 'a1', functionName: 'sum', fields: ['salary'], visible: true },
    ]);

    return (
      <div className="max-w-5xl border rounded-lg overflow-hidden">
        <ControlPanel
          filterColumns={[]}
          availableFields={AVAILABLE_FIELDS}
          aggregateFields={AGGREGATE_FIELDS}
          groupFields={groupFields}
          pivotFields={pivotFields}
          aggregateEntries={aggEntries}
          aggregateFunctions={AGGREGATE_FUNCTIONS}
          onFilterChange={() => {}}
          onGroupChange={(fields) =>
            setGroupFields(
              fields.map((f) => ({
                field: f,
                displayName: AVAILABLE_FIELDS.find((af) => af.field === f)?.displayName ?? f,
              })),
            )
          }
          onPivotChange={(fields) =>
            setPivotFields(
              fields.map((f) => ({
                field: f,
                displayName: AVAILABLE_FIELDS.find((af) => af.field === f)?.displayName ?? f,
              })),
            )
          }
          onAggregateChange={setAggEntries}
        />
      </div>
    );
  },
};
