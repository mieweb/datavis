/**
 * FilterBar.stories — Storybook stories for the filter system.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FilterBar } from './filters/FilterBar';
import type { ColumnFilterConfig, FilterSpec } from './filters/types';

const DEMO_COLUMNS: ColumnFilterConfig[] = [
  {
    field: 'name',
    displayName: 'Name',
    filterType: 'string',
    widget: 'textbox',
    visible: true,
  },
  {
    field: 'department',
    displayName: 'Department',
    filterType: 'string',
    widget: 'dropdown',
    options: ['Engineering', 'Marketing', 'Design', 'Sales', 'HR'],
    visible: true,
  },
  {
    field: 'age',
    displayName: 'Age',
    filterType: 'number',
    widget: 'textbox',
    visible: true,
  },
  {
    field: 'hire_date',
    displayName: 'Hire Date',
    filterType: 'date',
    visible: true,
  },
  {
    field: 'active',
    displayName: 'Active',
    filterType: 'boolean',
    visible: true,
  },
  {
    field: 'salary',
    displayName: 'Salary',
    filterType: 'currency',
    visible: true,
  },
  {
    field: 'full_time',
    displayName: 'Full Time',
    filterType: 'number',
    widget: 'tribool',
    visible: true,
  },
];

function FilterBarWrapper() {
  const [spec, setSpec] = useState<FilterSpec>({});
  return (
    <div className="max-w-4xl">
      <FilterBar
        columns={DEMO_COLUMNS}
        onFilterChange={setSpec}
      />
      <pre className="mt-4 p-3 bg-gray-100 rounded text-xs overflow-auto">
        {JSON.stringify(spec, null, 2)}
      </pre>
    </div>
  );
}

const meta: Meta = {
  title: 'DataVis/FilterBar',
  component: FilterBar,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FilterBarWrapper />,
};

export const WithInitialFilter: Story = {
  render: () => {
    const [spec, setSpec] = useState<FilterSpec>({
      department: { $in: ['Engineering', 'Design'] },
      age: { $gte: 25 },
    });
    return (
      <div className="max-w-4xl">
        <FilterBar
          columns={DEMO_COLUMNS}
          initialSpec={spec}
          onFilterChange={setSpec}
        />
        <pre className="mt-4 p-3 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>
    );
  },
};
