import { useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DataGrid } from './components/DataGrid';
import type { ViewInstance } from './adapters/use-data';
import type { SourceInstance } from './adapters/use-data';
import type { ColumnFilterConfig } from './components/filters/types';
import type { AggregateFunction } from './components/controls/AggregateSection';

/**
 * Creates a mock Source that mimics the wcdatavis event system.
 */
function createMockSource(): SourceInstance {
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
    getData(cont: (ok: boolean, data: unknown) => void) { setTimeout(() => cont(true, []), 100); },
    getTypeInfo(cont: (ok: boolean, ti: unknown) => void) { cont(true, {}); },
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) { cont(true, {}); },
    getDisplayName(cont: (ok: boolean, name: string) => void) { cont(true, 'Demo Source'); },
    clearCachedData() {},
    refresh() {},
    cancel() {},
    isCancellable() { return false; },
    swapRows() {},
    setToolbar() {},
  };
}

/**
 * Creates a mock ComputedView that simulates the data pipeline.
 */
function createMockView(): ViewInstance {
  const source = createMockSource();
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
      setTimeout(() => {
        view.fire('workBegin');
        setTimeout(() => {
          view.data = {
            isPlain: true, isGroup: false, isPivot: false,
            data: [
              { name: 'Alice Johnson', age: 30, department: 'Engineering', status: 'Active' },
              { name: 'Bob Smith', age: 25, department: 'Marketing', status: 'Active' },
              { name: 'Charlie Brown', age: 35, department: 'Engineering', status: 'Inactive' },
              { name: 'Diana Prince', age: 28, department: 'Design', status: 'Active' },
              { name: 'Eve Torres', age: 32, department: 'Marketing', status: 'Active' },
            ],
          };
          view.fire('workEnd', { isPlain: true, isGroup: false, isPivot: false, numRows: 5, totalRows: 5, numGroups: 0 });
          cont?.(true, view.data);
        }, 400);
      }, 200);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) { cont?.(true, {}); },
    setSort() {}, setFilter() {}, setGroup() {}, setPivot() {}, setAggregate() {},
    clearSort() {}, clearFilter() {}, clearGroup() {}, clearPivot() {}, clearAggregate() {},
    getSort() { return null; }, getAggregate() { return null; },
    getRowCount() { return 5; }, getTotalRowCount() { return 5; },
    clearCache() {}, refresh() { view.getData(); }, reset() {},
    setColConfig() {}, setPrefs() {}, unlimit() {},
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) { cont(true, {}); },
  } as unknown as ViewInstance;
  return view;
}

/**
 * Demo app — exercises the Phase 0/1 DataGrid shell.
 */
function App() {
  const view = useMemo(() => createMockView(), []);

  /** Simple i18n lookup for demo labels */
  const trans = useCallback((key: string): string => {
    const labels: Record<string, string> = {
      'GRID.TITLEBAR.TITLE': 'Grid',
      'GRID.TITLEBAR.LOADING': 'Loading…',
      'GRID.TITLEBAR.RECORD_COUNT_SINGULAR': 'record',
      'GRID.TITLEBAR.RECORD_COUNT_PLURAL': 'records',
      'GRID.TITLEBAR.RECORD_COUNT_FILTERED': '%d of %d records',
      'GRID.TITLEBAR.CLEAR_FILTER': 'Clear Filter',
      'GRID.TITLEBAR.CANCEL': 'Cancel',
      'GRID.TITLEBAR.HELP': 'Help',
      'GRID.TITLEBAR.DEBUG': 'Debug',
      'GRID.TITLEBAR.EXPORT': 'Export',
      'GRID.TITLEBAR.REFRESH': 'Refresh',
      'GRID.TITLEBAR.CONTROLS': 'Controls',
      'GRID.TITLEBAR.COLLAPSE': 'Collapse',
      'GRID.TITLEBAR.EXPAND': 'Expand',
      'GRID.LOADING.FETCHING': 'Fetching data…',
      'GRID.LOADING.PROCESSING': 'Processing…',
      'GRID_TOOLBAR.LABEL': 'Grid Toolbar',
      'GRID_TOOLBAR.PLAIN.SHOW_MORE_ON_SCROLL': 'Auto-show more',
      'GRID_TOOLBAR.PLAIN.SHOW_ALL_ROWS': 'Show All',
      'GRID_TOOLBAR.PLAIN.COLUMNS': 'Columns',
      'GRID_TOOLBAR.PLAIN.TEMPLATES_EDITOR': 'Templates',
      'GRID_TOOLBAR.PLAIN.ROW_MODE': 'Row Mode',
      'GRID_TOOLBAR.PLAIN.ROW_MODE.WRAPPED': 'Wrapped',
      'GRID_TOOLBAR.PLAIN.ROW_MODE.CLIPPED': 'Clipped',
      'GRID_TOOLBAR.PLAIN.AUTO_RESIZE_COLUMNS': 'Auto Resize',
      'GRID_CONTROL.TITLE': 'Controls',
      'GRID_CONTROL.OPERATIONS.TITLE': 'Actions',
      'FILTER.TITLE': 'Filters',
      'FILTER.TOOLBAR': 'Filters',
      'FILTER.OPERATOR': 'operator',
      'FILTER.CLEAR_ALL': 'Clear all filters',
      'FILTER.SELECT_VALUES': 'Select…',
      'FILTER.ALL_SELECTED': 'All selected',
      'FILTER.SEARCH': 'Search…',
      'FILTER.SELECT_ALL': 'All',
      'FILTER.CLEAR_SELECTION': 'None',
      'CONTROL.GROUP': 'Group',
      'CONTROL.PIVOT': 'Pivot',
      'CONTROL.AGGREGATE': 'Aggregate',
      'CONTROL.ADD_FIELD': '+ Add field…',
      'CONTROL.CLEAR': 'Clear all',
      'CONTROL.REMOVE': 'Remove',
      'CONTROL.DROP_HINT': 'Add or drag fields here',
      'CONTROL.ADD_AGGREGATE': '+ Add aggregate…',
      'CONTROL.SELECT_FIELD': 'Field…',
      'CONTROL.VISIBLE': 'Visible',
    };
    return labels[key] ?? key;
  }, []);

  const filterColumns: ColumnFilterConfig[] = useMemo(
    () => [
      { field: 'name', displayName: 'Name', filterType: 'string', widget: 'textbox', visible: true },
      {
        field: 'department',
        displayName: 'Department',
        filterType: 'string',
        widget: 'dropdown',
        options: ['Engineering', 'Marketing', 'Design'],
        visible: true,
      },
      { field: 'age', displayName: 'Age', filterType: 'number', visible: true },
      { field: 'status', displayName: 'Status', filterType: 'string', widget: 'dropdown', options: ['Active', 'Inactive'], visible: true },
    ],
    [],
  );

  const controlFields = useMemo(
    () => [
      { field: 'name', displayName: 'Name' },
      { field: 'department', displayName: 'Department' },
      { field: 'status', displayName: 'Status' },
      { field: 'age', displayName: 'Age' },
    ],
    [],
  );

  const aggregateFields = useMemo(
    () => [{ field: 'age', displayName: 'Age' }],
    [],
  );

  const aggregateFunctions: AggregateFunction[] = useMemo(
    () => [
      { name: 'sum', label: 'Sum', fieldCount: 1 },
      { name: 'avg', label: 'Average', fieldCount: 1 },
      { name: 'count', label: 'Count', fieldCount: 0 },
      { name: 'min', label: 'Min', fieldCount: 1 },
      { name: 'max', label: 'Max', fieldCount: 1 },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-xl font-bold mb-4 text-gray-800">WC DataVis — Phase 2 Demo</h1>

      <DataGrid
        view={view}
        title="Employee Directory"
        helpText="Demo grid with filters and controls. Click the ⚙ Controls button to expand."
        showToolbar={true}
        showControls={true}
        trans={trans}
        filterColumns={filterColumns}
        controlFields={controlFields}
        aggregateFields={aggregateFields}
        aggregateFunctions={aggregateFunctions}
        operations={[
          { label: 'Edit', icon: '✏️', category: 'Actions', callback: () => alert('Edit clicked') },
          { label: 'Delete', icon: '🗑️', category: 'Actions', callback: () => alert('Delete clicked') },
          { label: 'Export CSV', icon: '📥', category: 'Export', callback: () => alert('Export clicked') },
        ]}
      >
        <div className="p-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Age</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Department</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Alice Johnson', age: 30, department: 'Engineering', status: 'Active' },
                { name: 'Bob Smith', age: 25, department: 'Marketing', status: 'Active' },
                { name: 'Charlie Brown', age: 35, department: 'Engineering', status: 'Inactive' },
                { name: 'Diana Prince', age: 28, department: 'Design', status: 'Active' },
                { name: 'Eve Torres', age: 32, department: 'Marketing', status: 'Active' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-blue-50">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.age}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataGrid>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

