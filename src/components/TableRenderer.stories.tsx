/**
 * TableRenderer stories — demonstrates all table renderer variants.
 */

import { useState } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { Button } from '@mieweb/ui/components/Button';
import { PlainTable } from './table/PlainTable';
import { GroupDetailTable } from './table/GroupDetailTable';
import { GroupSummaryTable } from './table/GroupSummaryTable';
import { PivotTable } from './table/PivotTable';
import { TableProgress } from './table/TableProgress';
import { TableRenderer } from './table/TableRenderer';
import type {
  TableColumn,
  TableRow,
  SortSpec,
  GroupMeta,
} from './table/types';
import type { PivotData } from './table/PivotTable';

// ───────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────

const COLUMNS: TableColumn[] = [
  { field: 'name', header: 'Name', width: 150, sortable: true, resizable: true },
  { field: 'department', header: 'Department', width: 130, sortable: true, resizable: true },
  { field: 'role', header: 'Role', width: 140, sortable: true, resizable: true },
  { field: 'salary', header: 'Salary', width: 100, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'age', header: 'Age', width: 60, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'startDate', header: 'Start Date', width: 120, sortable: true, resizable: true },
  { field: 'active', header: 'Active', width: 70, sortable: true },
];

const ROWS: TableRow[] = [
  { rowNum: 0, data: { name: 'Alice Johnson', department: 'Engineering', role: 'Senior Engineer', salary: 125000, age: 32, startDate: '2019-03-15', active: true } },
  { rowNum: 1, data: { name: 'Bob Smith', department: 'Marketing', role: 'Marketing Manager', salary: 95000, age: 28, startDate: '2020-06-01', active: true } },
  { rowNum: 2, data: { name: 'Charlie Brown', department: 'Engineering', role: 'Staff Engineer', salary: 145000, age: 36, startDate: '2017-09-12', active: true } },
  { rowNum: 3, data: { name: 'Diana Prince', department: 'Product', role: 'Product Manager', salary: 115000, age: 30, startDate: '2021-01-10', active: true } },
  { rowNum: 4, data: { name: 'Eve Wilson', department: 'Engineering', role: 'Junior Engineer', salary: 85000, age: 24, startDate: '2023-05-20', active: true } },
  { rowNum: 5, data: { name: 'Frank Lee', department: 'Marketing', role: 'Content Writer', salary: 72000, age: 26, startDate: '2022-08-15', active: false } },
  { rowNum: 6, data: { name: 'Grace Kim', department: 'Product', role: 'Designer', salary: 98000, age: 29, startDate: '2020-11-03', active: true } },
  { rowNum: 7, data: { name: 'Henry Davis', department: 'Engineering', role: 'DevOps Engineer', salary: 120000, age: 34, startDate: '2018-07-22', active: true } },
  { rowNum: 8, data: { name: 'Iris Chen', department: 'Marketing', role: 'SEO Specialist', salary: 78000, age: 27, startDate: '2021-09-01', active: true } },
  { rowNum: 9, data: { name: 'Jack Turner', department: 'Product', role: 'UX Researcher', salary: 92000, age: 31, startDate: '2020-02-14', active: false } },
  { rowNum: 10, data: { name: 'Karen Miller', department: 'Engineering', role: 'QA Engineer', salary: 95000, age: 33, startDate: '2019-11-18', active: true } },
  { rowNum: 11, data: { name: 'Leo Garcia', department: 'Marketing', role: 'Brand Manager', salary: 105000, age: 35, startDate: '2018-04-06', active: true } },
];

// ───────────────────────────────────────────────────────────
// Stories
// ───────────────────────────────────────────────────────────

const meta = {
  title: 'Grid/TableRenderer',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

// ── Plain Table ─────────────────────────────────

export const Plain: StoryFn = () => {
  const [sort, setSort] = useState<SortSpec | null>(null);

  return (
    <div className="h-[500px] border border-gray-200 rounded-lg overflow-hidden">
      <PlainTable
        columns={COLUMNS}
        rows={ROWS}
        sort={sort}
        totalRows={ROWS.length}
        features={{
          columnResize: true,
          columnReorder: true,
          stickyHeaders: true,
          rowSelection: true,
          headerContextMenu: true,
          zebraStripe: true,
          keyboardNav: true,
        }}
        onSort={(field, direction) => setSort({ field, direction })}
        onRowClick={(row) => console.log('Row clicked:', row.data)}
        onRowDoubleClick={(row) => console.log('Row double-clicked:', row.data)}
        onColumnResize={(field, width) => console.log('Column resized:', field, width)}
        onColumnReorder={(from, to) => console.log('Column reordered:', from, '→', to)}
      />
    </div>
  );
};

// ── Plain with Limit ────────────────────────────

export const PlainWithLimit: StoryFn = () => {
  const [visibleCount, setVisibleCount] = useState(5);

  return (
    <div className="h-[400px] border border-gray-200 rounded-lg overflow-hidden">
      <PlainTable
        columns={COLUMNS}
        rows={ROWS.slice(0, visibleCount)}
        totalRows={ROWS.length}
        limit={{ limit: 5 }}
        features={{ zebraStripe: true, stickyHeaders: true }}
        onShowMore={() => setVisibleCount((c) => Math.min(c + 5, ROWS.length))}
        onShowAll={() => setVisibleCount(ROWS.length)}
      />
    </div>
  );
};

// ── Clipped Row Mode ────────────────────────────

export const ClippedRowMode: StoryFn = () => {
  return (
    <div className="h-[400px] border border-gray-200 rounded-lg overflow-hidden">
      <PlainTable
        columns={COLUMNS}
        rows={ROWS}
        totalRows={ROWS.length}
        features={{
          zebraStripe: true,
          stickyHeaders: true,
          rowMode: 'clipped',
        }}
      />
    </div>
  );
};

// ── Empty Table ─────────────────────────────────

export const EmptyTable: StoryFn = () => {
  return (
    <div className="h-[300px] border border-gray-200 rounded-lg overflow-hidden">
      <PlainTable
        columns={COLUMNS}
        rows={[]}
        features={{ stickyHeaders: true }}
      />
    </div>
  );
};

// ── Group Detail ────────────────────────────────

const GROUP_FIELDS = ['department'];
const GROUPS: Record<string, GroupMeta> = {
  Engineering: { groupValues: { department: 'Engineering' }, count: 5, expanded: true, level: 0, aggregates: { salary: 570000 } },
  Marketing: { groupValues: { department: 'Marketing' }, count: 4, expanded: true, level: 0, aggregates: { salary: 350000 } },
  Product: { groupValues: { department: 'Product' }, count: 3, expanded: true, level: 0, aggregates: { salary: 305000 } },
};
const GROUPED_ROWS: Record<string, TableRow[]> = {
  Engineering: ROWS.filter((r) => r.data.department === 'Engineering'),
  Marketing: ROWS.filter((r) => r.data.department === 'Marketing'),
  Product: ROWS.filter((r) => r.data.department === 'Product'),
};
const GROUP_ORDER = ['Engineering', 'Marketing', 'Product'];

export const GroupDetail: StoryFn = () => {
  return (
    <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
      <GroupDetailTable
        columns={COLUMNS}
        rows={[]}
        groups={GROUPS}
        groupedRows={GROUPED_ROWS}
        groupOrder={GROUP_ORDER}
        groupFields={GROUP_FIELDS}
        totalRows={ROWS.length}
        showTotalRow={true}
        initialExpanded={true}
        totalAggregates={{ salary: 1225000 }}
        features={{ stickyHeaders: true, zebraStripe: true }}
      />
    </div>
  );
};

// ── Group Summary ───────────────────────────────

export const GroupSummary: StoryFn = () => {
  return (
    <div className="h-[400px] border border-gray-200 rounded-lg overflow-hidden">
      <GroupSummaryTable
        columns={COLUMNS}
        groups={GROUPS}
        groupOrder={GROUP_ORDER}
        groupFields={GROUP_FIELDS}
        totalRows={ROWS.length}
        showTotalRow={true}
        totalAggregates={{ salary: 1225000 }}
        features={{ stickyHeaders: true, zebraStripe: true }}
      />
    </div>
  );
};

// ── Pivot Table ─────────────────────────────────

const PIVOT_DATA: PivotData = {
  rowFields: ['department'],
  colFields: ['active'],
  rowVals: [
    { department: 'Engineering' },
    { department: 'Marketing' },
    { department: 'Product' },
  ],
  colVals: [true, false],
  matrix: [
    [{ count: 4, sum: 475000 }, { count: 1, sum: 95000 }],
    [{ count: 3, sum: 278000 }, { count: 1, sum: 72000 }],
    [{ count: 2, sum: 213000 }, { count: 1, sum: 92000 }],
  ],
  aggFunctions: ['count', 'sum'],
  totalCol: [
    { count: 5, sum: 570000 },
    { count: 4, sum: 350000 },
    { count: 3, sum: 305000 },
  ],
  totalRow: [
    { count: 9, sum: 966000 },
    { count: 3, sum: 259000 },
  ],
  grandTotal: { count: 12, sum: 1225000 },
};

export const Pivot: StoryFn = () => {
  return (
    <div className="h-[400px] border border-gray-200 rounded-lg overflow-hidden">
      <PivotTable
        columns={COLUMNS}
        pivotData={PIVOT_DATA}
        showTotalCol={true}
        features={{ stickyHeaders: true, zebraStripe: true }}
      />
    </div>
  );
};

// ── Progress Bar ────────────────────────────────

export const ProgressBar: StoryFn = () => {
  const [loaded, setLoaded] = useState(45);

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <TableProgress loaded={loaded} total={100} active={true} />
        <div className="p-4 text-sm text-gray-500">
          Progress bar shown during incremental loading.
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setLoaded((l) => Math.min(l + 10, 100))}>
          +10 rows
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLoaded(0)}>
          Reset
        </Button>
      </div>
    </div>
  );
};

// ── TableRenderer (unified) ─────────────────────

export const UnifiedPlain: StoryFn = () => {
  const [sort, setSort] = useState<SortSpec | null>(null);

  return (
    <div className="h-[500px] border border-gray-200 rounded-lg overflow-hidden">
      <TableRenderer
        viewData={{
          isPlain: true,
          isGroup: false,
          isPivot: false,
          data: ROWS.map((r) => r.data),
        }}
        columns={COLUMNS}
        sort={sort}
        totalRows={ROWS.length}
        features={{
          columnResize: true,
          columnReorder: true,
          stickyHeaders: true,
          zebraStripe: true,
          keyboardNav: true,
        }}
        onSort={(field, direction) => setSort({ field, direction })}
        onRowClick={(row) => console.log('Row clicked:', row.data)}
      />
    </div>
  );
};

export const UnifiedGroupDetail: StoryFn = () => {
  return (
    <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
      <TableRenderer
        viewData={{
          isPlain: false,
          isGroup: true,
          isPivot: false,
          data: ROWS.map((r) => r.data),
          groupFields: GROUP_FIELDS,
          groupMetadata: Object.fromEntries(
            GROUP_ORDER.map((key) => [key, {
              groupValues: GROUPS[key].groupValues,
              count: GROUPS[key].count,
              level: 0,
              aggregates: GROUPS[key].aggregates,
            }]),
          ),
        }}
        columns={COLUMNS}
        totalRows={ROWS.length}
        groupMode="detail"
        showTotalRow={true}
        features={{ stickyHeaders: true, zebraStripe: true }}
      />
    </div>
  );
};

export const NoData: StoryFn = () => {
  return (
    <div className="h-[300px] border border-gray-200 rounded-lg overflow-hidden">
      <TableRenderer
        viewData={null}
        columns={COLUMNS}
      />
    </div>
  );
};
