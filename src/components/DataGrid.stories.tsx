/**
 * DataGrid stories — demonstrates the grid shell component with mock data.
 */

import { useMemo } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { DataGrid } from '../components/DataGrid';
import { TableRenderer } from '../components/table/TableRenderer';
import type { TableColumn } from '../components/table/types';
import type { ViewInstance } from '../adapters/use-data';

// ───────────────────────────────────────────────────────────
// Mock objects — simulate wcdatavis core without real deps
// ───────────────────────────────────────────────────────────

function createMockSource() {
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void, opts?: { who?: unknown }) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ cb, who: opts?.who });
    },
    off(event: string, who: unknown) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((l) => l.who !== who);
    },
    fire(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((l) => l.cb(...args));
    },
    getData(cont: (ok: boolean, data: unknown) => void) {
      setTimeout(() => cont(true, []), 100);
    },
    getTypeInfo(cont: (ok: boolean, ti: unknown) => void) {
      cont(true, {});
    },
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) {
      cont(true, {});
    },
    getDisplayName(cont: (ok: boolean, name: string) => void) {
      cont(true, 'Mock Source');
    },
    clearCachedData() {},
    refresh() {},
    cancel() {},
    isCancellable() { return false; },
    swapRows() {},
    setToolbar() {},
  };
}

interface MockView extends ViewInstance {
  _sortSpec: { vertical?: { field: string; dir: string } } | null;
}

function createMockView(source = createMockSource()): MockView {
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};
  const view = {
    source,
    data: null as unknown,
    typeInfo: null,
    filterSpec: null,
    _sortSpec: null as { vertical?: { field: string; dir: string } } | null,
    on(event: string, cb: (...args: unknown[]) => void, opts?: { who?: unknown }) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ cb, who: opts?.who });
    },
    off(event: string, who: unknown) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((l) => l.who !== who);
    },
    fire(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((l) => l.cb(...args));
    },
    getData(cont?: (ok: boolean, data: unknown) => void) {
      // Simulate async data processing
      setTimeout(() => {
        view.fire('workBegin');
        setTimeout(() => {
          const rows = [
            { name: 'Alice', age: 30, department: 'Engineering' },
            { name: 'Bob', age: 25, department: 'Marketing' },
            { name: 'Charlie', age: 35, department: 'Engineering' },
          ];

          // Apply sort
          if (view._sortSpec?.vertical) {
            const { field, dir } = view._sortSpec.vertical;
            const direction = dir === 'DESC' ? -1 : 1;
            rows.sort((a, b) => {
              const va = (a as Record<string, unknown>)[field];
              const vb = (b as Record<string, unknown>)[field];
              if (va == null && vb == null) return 0;
              if (va == null) return direction;
              if (vb == null) return -direction;
              if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * direction;
              return String(va).localeCompare(String(vb)) * direction;
            });
          }

          view.data = {
            isPlain: true,
            isGroup: false,
            isPivot: false,
            data: rows,
          };
          view.fire('workEnd', {
            isPlain: true,
            isGroup: false,
            isPivot: false,
            numRows: 3,
            totalRows: 3,
            numGroups: 0,
          });
          cont?.(true, view.data);
        }, 200);
      }, 100);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) {
      cont?.(true, {});
    },
    setSort(spec: unknown) {
      view._sortSpec = spec as { vertical?: { field: string; dir: string } } | null;
      view.getData();
    },
    setFilter() {},
    setGroup(spec: unknown) { view.fire('groupSet', spec); },
    setPivot(spec: unknown) { view.fire('pivotSet', spec); },
    setAggregate(spec: unknown) { view.fire('aggregateSet', spec); },
    clearSort() {
      view._sortSpec = null;
      view.getData();
    },
    clearFilter() {},
    clearGroup() { view.fire('groupSet', null); },
    clearPivot() { view.fire('pivotSet', null); },
    clearAggregate() { view.fire('aggregateSet', null); },
    getSort() { return view._sortSpec; },
    getAggregate() { return null; },
    getRowCount() { return 3; },
    getTotalRowCount() { return 3; },
    clearCache() {},
    refresh() { view.getData(); },
    reset() {},
    setColConfig() {},
    setPrefs() {},
    unlimit() {},
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) {
      cont(true, {});
    },
  } as unknown as MockView;
  return view;
}

// ───────────────────────────────────────────────────────────
// Stories
// ───────────────────────────────────────────────────────────

const meta = {
  title: 'Grid/DataGrid',
  component: DataGrid,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DataGrid>;

export default meta;

export const Default: StoryFn = () => {
    const view = useMemo(() => createMockView(), []);

    const columns: TableColumn[] = [
      { field: 'name', header: 'Name', width: 150, sortable: true, resizable: true },
      { field: 'age', header: 'Age', width: 80, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
      { field: 'department', header: 'Department', width: 140, sortable: true, resizable: true },
    ];

    return (
      <DataGrid
        view={view}
        title="Sample Grid"
        helpText="This is a demo grid with mock data"
        showToolbar={true}
      >
        <TableRenderer
          viewData={{
            isPlain: true,
            isGroup: false,
            isPivot: false,
            data: [
              { name: 'Alice', age: 30, department: 'Engineering' },
              { name: 'Bob', age: 25, department: 'Marketing' },
              { name: 'Charlie', age: 35, department: 'Engineering' },
            ],
          }}
          columns={columns}
          totalRows={3}
          features={{
            columnResize: true,
            columnReorder: true,
            stickyHeaders: true,
            zebraStripe: true,
            keyboardNav: true,
          }}
        />
      </DataGrid>
    );
  };

export const WithOperations: StoryFn = () => {
    const view = useMemo(() => createMockView(), []);
    return (
      <DataGrid
        view={view}
        title="Grid with Operations"
        operations={[
          { label: 'Edit', icon: '✏', category: 'Actions', callback: (ctx) => alert(`Edit: ${ctx.rows.length} rows`) },
          { label: 'Delete', icon: '🗑', category: 'Actions', callback: (ctx) => alert(`Delete: ${ctx.rows.length} rows`) },
          { label: 'Export', icon: '⬇', category: 'Export', callback: () => alert('Exporting...') },
        ]}
      >
        <div className="p-4 text-gray-500 text-center">
          Operations palette visible above the table area.
        </div>
      </DataGrid>
    );
  };

export const Collapsed: StoryFn = () => {
    const view = useMemo(() => createMockView(), []);
    return (
      <DataGrid
        view={view}
        title="Collapsible Grid"
      >
        <div className="p-4 text-gray-500 text-center">
          Click the ▼ button to collapse.
        </div>
      </DataGrid>
    );
  };
