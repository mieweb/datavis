/**
 * DataGrid stories — demonstrates the grid shell component with mock data.
 */

import { useMemo } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { DataGrid } from '../components/DataGrid';
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

function createMockView(source = createMockSource()): ViewInstance {
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};
  const view = {
    source,
    data: null as unknown,
    typeInfo: null,
    filterSpec: null,
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
          view.data = {
            isPlain: true,
            isGroup: false,
            isPivot: false,
            data: [
              { name: 'Alice', age: 30, department: 'Engineering' },
              { name: 'Bob', age: 25, department: 'Marketing' },
              { name: 'Charlie', age: 35, department: 'Engineering' },
            ],
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
    setSort() {},
    setFilter() {},
    setGroup() {},
    setPivot() {},
    setAggregate() {},
    clearSort() {},
    clearFilter() {},
    clearGroup() {},
    clearPivot() {},
    clearAggregate() {},
    getSort() { return null; },
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
  } as unknown as ViewInstance;
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
    return (
      <DataGrid
        view={view}
        title="Sample Grid"
        helpText="This is a demo grid with mock data"
        showToolbar={true}
      >
        <div className="p-4 text-gray-500 text-center">
          <p>Table renderer will be implemented in Phase 4.</p>
          <p className="text-sm mt-2">Data loads via the adapter hooks.</p>
        </div>
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
