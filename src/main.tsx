/**
 * Demo app — three example DataGrid pages:
 *
 * 1. Simple     — 5 rows, 4 columns (employee directory)
 * 2. Wide (50c) — 20 rows, 50 columns (contact + appointment + location)
 * 3. Large (5K) — 5 000 rows, 33 columns (financial ledger + inventory)
 */

import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DataGrid } from './components/DataGrid';
import { TableRenderer } from './components/table/TableRenderer';
import type { TableColumn, SortSpec } from './components/table/types';
import type { ViewInstance } from './adapters/use-data';
import type { SourceInstance } from './adapters/use-data';
import type { ColumnFilterConfig } from './components/filters/types';
import type { AggregateFunction } from './components/controls/AggregateSection';

import {
  SIMPLE_DATA, SIMPLE_COLUMNS, SIMPLE_FILTERS,
  generateWideData, WIDE_COLUMNS, WIDE_FILTERS,
  generateLedgerData, LEDGER_COLUMNS, LEDGER_FILTERS,
} from './demo/data';

// ───────────────────────────────────────────────────────────
// Mock adapter factories
// ───────────────────────────────────────────────────────────

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

function createMockView(data: Record<string, unknown>[], rowCount: number): ViewInstance {
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
    getData(cont?: (ok: boolean, d: unknown) => void) {
      setTimeout(() => {
        view.fire('workBegin');
        setTimeout(() => {
          view.data = { isPlain: true, isGroup: false, isPivot: false, data };
          view.fire('workEnd', {
            isPlain: true, isGroup: false, isPivot: false,
            numRows: rowCount, totalRows: rowCount, numGroups: 0,
          });
          cont?.(true, view.data);
        }, data.length > 1000 ? 600 : 300);
      }, 100);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) { cont?.(true, {}); },
    setSort() {}, setFilter() {}, setGroup() {}, setPivot() {}, setAggregate() {},
    clearSort() {}, clearFilter() {}, clearGroup() {}, clearPivot() {}, clearAggregate() {},
    getSort() { return null; }, getAggregate() { return null; },
    getRowCount() { return rowCount; }, getTotalRowCount() { return rowCount; },
    clearCache() {}, refresh() { view.getData(); }, reset() {},
    setColConfig() {}, setPrefs() {}, unlimit() {},
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) { cont(true, {}); },
  } as unknown as ViewInstance;
  return view;
}

// ───────────────────────────────────────────────────────────
// Shared i18n labels
// ───────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
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
  'TABLE.SHOWING': 'Showing',
  'TABLE.OF': 'of',
  'TABLE.ROWS': 'rows',
  'TABLE.NO_DATA': 'No data to display',
  'TABLE.SHOW_MORE': 'Show More',
  'TABLE.SHOW_ALL': 'Show All',
  'TABLE.GROUPS': 'groups',
  'TABLE.TOTAL': 'Total',
  'TABLE.SORT_ASC': 'Sort Ascending',
  'TABLE.SORT_DESC': 'Sort Descending',
  'TABLE.HIDE_COLUMN': 'Hide Column',
};

const trans = (key: string): string => LABELS[key] ?? key;

const AGG_FUNCTIONS: AggregateFunction[] = [
  { name: 'sum', label: 'Sum', fieldCount: 1 },
  { name: 'avg', label: 'Average', fieldCount: 1 },
  { name: 'count', label: 'Count', fieldCount: 0 },
  { name: 'min', label: 'Min', fieldCount: 1 },
  { name: 'max', label: 'Max', fieldCount: 1 },
];

// ───────────────────────────────────────────────────────────
// Tab definitions
// ───────────────────────────────────────────────────────────

type TabKey = 'simple' | 'wide' | 'large';

interface TabDef {
  key: TabKey;
  label: string;
  badge: string;
}

const TABS: TabDef[] = [
  { key: 'simple', label: 'Simple', badge: '8 rows × 8 cols' },
  { key: 'wide', label: 'Wide (50 columns)', badge: '20 rows × 50 cols' },
  { key: 'large', label: 'Large (5K rows)', badge: '5 000 rows × 33 cols' },
];

// ───────────────────────────────────────────────────────────
// GridDemo — one per tab to isolate state
// ───────────────────────────────────────────────────────────

function GridDemo({
  title,
  helpText,
  data,
  columns,
  filters,
  controlFields,
  aggregateFields,
}: {
  title: string;
  helpText: string;
  data: Record<string, unknown>[];
  columns: TableColumn[];
  filters: ColumnFilterConfig[];
  controlFields: { field: string; displayName: string }[];
  aggregateFields: { field: string; displayName: string }[];
}) {
  const view = useMemo(() => createMockView(data, data.length), [data]);
  const [sort, setSort] = useState<SortSpec | null>(null);

  return (
    <DataGrid
      view={view}
      title={title}
      helpText={helpText}
      showToolbar={true}
      showControls={true}
      debug={true}
      trans={trans}
      filterColumns={filters}
      controlFields={controlFields}
      aggregateFields={aggregateFields}
      aggregateFunctions={AGG_FUNCTIONS}
    >
      <TableRenderer
        viewData={{ isPlain: true, isGroup: false, isPivot: false, data }}
        columns={columns}
        sort={sort}
        totalRows={data.length}
        features={{
          columnResize: true,
          columnReorder: true,
          stickyHeaders: true,
          zebraStripe: true,
          keyboardNav: true,
          headerContextMenu: true,
        }}
        trans={trans}
        onSort={(field, direction) => setSort({ field, direction })}
        onRowClick={(row) => console.log('Row clicked:', row.data)}
      />
    </DataGrid>
  );
}

// ───────────────────────────────────────────────────────────
// App — tabbed demo
// ───────────────────────────────────────────────────────────

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('simple');

  // Generate data lazily (only once)
  const wideData = useMemo(() => generateWideData(20), []);
  const ledgerData = useMemo(() => generateLedgerData(5000), []);

  // Control/aggregate fields derived from columns
  const simpleControlFields = useMemo(
    () => SIMPLE_COLUMNS.map((c) => ({ field: c.field, displayName: c.header })),
    [],
  );
  const wideControlFields = useMemo(
    () => WIDE_COLUMNS.slice(0, 20).map((c) => ({ field: c.field, displayName: c.header })),
    [],
  );
  const ledgerControlFields = useMemo(
    () => LEDGER_COLUMNS
      .filter((c) => !['memo', 'reference'].includes(c.field))
      .slice(0, 15)
      .map((c) => ({ field: c.field, displayName: c.header })),
    [],
  );

  const simpleAggFields = useMemo(
    () => [
      { field: 'salary', displayName: 'Salary' },
      { field: 'projects', displayName: 'Projects' },
    ],
    [],
  );
  const wideAggFields = useMemo(
    () => [
      { field: 'duration', displayName: 'Duration (min)' },
      { field: 'attendeeCount', displayName: 'Attendees' },
      { field: 'squareFootage', displayName: 'Sq Ft' },
    ],
    [],
  );
  const ledgerAggFields = useMemo(
    () => [
      { field: 'debit', displayName: 'Debit' },
      { field: 'credit', displayName: 'Credit' },
      { field: 'amount', displayName: 'Amount' },
      { field: 'quantity', displayName: 'Qty' },
      { field: 'lineTotal', displayName: 'Line Total' },
      { field: 'unitCost', displayName: 'Unit Cost' },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Page header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">WC DataVis — Demo</h1>
        <p className="text-sm text-gray-500 mt-1">
          React table renderer with column resize, reorder, sort, sticky headers, and context menus.
        </p>
      </header>

      {/* Tab bar */}
      <nav
        className="bg-white border-b border-gray-200 px-6"
        role="tablist"
        aria-label="Demo examples"
      >
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="ml-2 text-xs font-normal text-gray-400">{tab.badge}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="p-6">
        {activeTab === 'simple' && (
          <GridDemo
            title="Employee Directory"
            helpText="8-row employee table with every data type: string, count, currency, date, boolean, and parent reference (Manager). Try sorting, column resize, and right-click context menus."
            data={SIMPLE_DATA}
            columns={SIMPLE_COLUMNS}
            filters={SIMPLE_FILTERS}
            controlFields={simpleControlFields}
            aggregateFields={simpleAggFields}
          />
        )}

        {activeTab === 'wide' && (
          <GridDemo
            title="Contact Database — 50 Columns"
            helpText="Wide table with contact info, appointment details, and location properties. Scroll horizontally to see all 50 columns. Try dragging columns to reorder."
            data={wideData}
            columns={WIDE_COLUMNS}
            filters={WIDE_FILTERS}
            controlFields={wideControlFields}
            aggregateFields={wideAggFields}
          />
        )}

        {activeTab === 'large' && (
          <GridDemo
            title="Financial Ledger — 5,000 Transactions"
            helpText="Large dataset with journal entries, accounts, vendors, customers, and linked inventory items. Tests rendering performance with 5K rows."
            data={ledgerData}
            columns={LEDGER_COLUMNS}
            filters={LEDGER_FILTERS}
            controlFields={ledgerControlFields}
            aggregateFields={ledgerAggFields}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

