/**
 * Demo app — three example DataGrid pages:
 *
 * 1. Simple     — 5 rows, 4 columns (employee directory)
 * 2. Wide (50c) — 20 rows, 50 columns (contact + appointment + location)
 * 3. Large (5K) — 5 000 rows, 33 columns (financial ledger + inventory)
 */

import { useMemo, useState, useEffect } from 'react';
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
import { applyFilter } from './demo/apply-filter';
import type { FilterSpec } from './components/filters/types';
import enUsTsv from '../wcdatavis/en-US.tsv?raw';

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

interface MockView extends ViewInstance {
  _filterSpec: FilterSpec | null;
  filterSpec: FilterSpec | null;
}

function createMockView(data: Record<string, unknown>[], rowCount: number): MockView {
  const source = createMockSource();
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};
  const view = {
    source,
    data: null as unknown,
    typeInfo: null,
    filterSpec: null as FilterSpec | null,
    _filterSpec: null as FilterSpec | null,
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
          const filtered = view._filterSpec
            ? applyFilter(data, view._filterSpec)
            : data;
          view.data = { isPlain: true, isGroup: false, isPivot: false, data: filtered };
          view.fire('workEnd', {
            isPlain: true, isGroup: false, isPivot: false,
            numRows: filtered.length, totalRows: rowCount, numGroups: 0,
          });
          cont?.(true, view.data);
        }, data.length > 1000 ? 600 : 300);
      }, 100);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) { cont?.(true, {}); },
    setSort() {},
    setFilter(spec: unknown) {
      view._filterSpec = spec as FilterSpec;
      view.filterSpec = spec as FilterSpec;
      view.getData();
    },
    setGroup() {}, setPivot() {}, setAggregate() {},
    clearSort() {},
    clearFilter() {
      view._filterSpec = null;
      view.filterSpec = null;
      view.getData();
    },
    clearGroup() {}, clearPivot() {}, clearAggregate() {},
    getSort() { return null; }, getAggregate() { return null; },
    getRowCount() {
      const d = view.data as { data?: unknown[] } | null;
      return d?.data?.length ?? rowCount;
    },
    getTotalRowCount() { return rowCount; },
    clearCache() {}, refresh() { view.getData(); }, reset() {},
    setColConfig() {}, setPrefs() {}, unlimit() {},
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) { cont(true, {}); },
  } as unknown as MockView;
  return view;
}

// ───────────────────────────────────────────────────────────
// Shared i18n labels — parsed from wcdatavis/en-US.tsv (single source of truth)
// ───────────────────────────────────────────────────────────

function parseTsv(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('//') || line.startsWith('Translation Label')) continue;
    const [key, value] = line.split('\t');
    if (key && /^[A-Z0-9_.-]+$/.test(key.trim())) {
      labels[key.trim()] = value?.trim() ?? key.trim();
    }
  }
  return labels;
}

const LABELS = parseTsv(enUsTsv);

const trans = (key: string, ...args: unknown[]): string => {
  let text = LABELS[key] ?? key;
  for (const arg of args) {
    text = text.replace('%s', String(arg ?? ''));
  }
  return text;
};

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

  // Track the filtered data from the mock view's workEnd cycle.
  // When filters are applied, the view re-runs getData() with filtered results.
  const [displayData, setDisplayData] = useState<Record<string, unknown>[]>(data);

  useEffect(() => {
    const handler = () => {
      const viewData = (view as unknown as { data: { data: Record<string, unknown>[] } | null }).data;
      if (viewData?.data) {
        setDisplayData(viewData.data);
      }
    };
    view.on('workEnd', handler, { who: 'GridDemo' });
    return () => view.off('workEnd', 'GridDemo');
  }, [view]);

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
      allColumns={columns}
      controlFields={controlFields}
      aggregateFields={aggregateFields}
      aggregateFunctions={AGG_FUNCTIONS}
    >
      <TableRenderer
        viewData={{ isPlain: true, isGroup: false, isPivot: false, data: displayData }}
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

function getTabFromHash(): TabKey {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'wide' || hash === 'large') return hash;
  return 'simple';
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(getTabFromHash);

  // Sync hash → state on popstate (browser back/forward)
  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Update hash when tab changes
  const switchTab = (key: TabKey) => {
    window.location.hash = key;
    setActiveTab(key);
  };

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
      <div
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
              onClick={() => switchTab(tab.key)}
            >
              {tab.label}
              <span className="ml-2 text-xs font-normal text-gray-400">{tab.badge}</span>
            </button>
          ))}
        </div>
      </div>

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

