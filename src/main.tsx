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
import type { TableColumn } from './components/table/types';
import type { ViewInstance } from './adapters/use-data';
import type { SourceInstance } from './adapters/use-data';
import type { ColumnFilterConfig } from './components/filters/types';
import type { AggregateFunction } from './components/controls/AggregateSection';
import { getBuiltinGroupFunctions } from './adapters/group-adapter';

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

interface GroupSpec {
  fieldNames: { field: string; fun?: string }[];
}

interface AggSpec {
  fn: string;
  fields: string[];
}

interface MockView extends ViewInstance {
  _filterSpec: FilterSpec | null;
  filterSpec: FilterSpec | null;
  _sortSpec: { vertical?: { field: string; dir: string } } | null;
  _groupSpec: GroupSpec | null;
  _aggSpec: AggSpec[] | null;
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
    _sortSpec: null as { vertical?: { field: string; dir: string } } | null,
    _groupSpec: null as GroupSpec | null,
    _aggSpec: null as AggSpec[] | null,
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
          const result = view._filterSpec
            ? applyFilter(data, view._filterSpec)
            : [...data];

          // Apply sort
          if (view._sortSpec?.vertical) {
            const { field, dir } = view._sortSpec.vertical;
            const direction = dir === 'DESC' ? -1 : 1;
            result.sort((a, b) => {
              const va = a[field];
              const vb = b[field];
              if (va == null && vb == null) return 0;
              if (va == null) return direction;
              if (vb == null) return -direction;
              if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * direction;
              if (typeof va === 'boolean' && typeof vb === 'boolean') return ((va ? 1 : 0) - (vb ? 1 : 0)) * direction;
              return String(va).localeCompare(String(vb)) * direction;
            });
          }

          // Determine group mode
          const groupFields = (view._groupSpec?.fieldNames ?? []).map((f) => f.field);
          const isGroup = groupFields.length > 0;

          // Compute per-group aggregates when both grouping and aggregates are active
          let groupMetadata: Record<string, unknown> | undefined;
          if (isGroup) {
            const buckets = new Map<string, Record<string, unknown>[]>();
            for (const row of result) {
              const key = groupFields.map((f) => String(row[f] ?? '')).join('|||');
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key)!.push(row);
            }
            if (view._aggSpec && view._aggSpec.length > 0) {
              const aggSpecs: AggSpec[] = view._aggSpec;
              groupMetadata = {};
              for (const [key, rows] of buckets) {
                const aggregates: Record<string, unknown> = {};
                for (const agg of aggSpecs) {
                  const field: string | undefined = agg.fields[0];
                  const label = field ? `${agg.fn}(${field})` : agg.fn;
                  if (agg.fn === 'count') {
                    aggregates[label] = rows.length;
                  } else if (field) {
                    if (agg.fn === 'counta') {
                      aggregates[label] = rows.filter((r) => r[field] != null && r[field] !== '').length;
                    } else if (agg.fn === 'countu') {
                      aggregates[label] = new Set(rows.map((r) => r[field]).filter((v) => v != null && v !== '')).size;
                    } else if (agg.fn === 'list') {
                      const uniq = [...new Set(rows.map((r) => r[field]).filter((v) => v != null && v !== '').map(String))];
                      aggregates[label] = uniq.join(', ');
                    } else {
                      const nums = rows.map((r) => Number(r[field])).filter((n) => !isNaN(n));
                      if (agg.fn === 'sum') aggregates[label] = nums.reduce((a, b) => a + b, 0);
                      else if (agg.fn === 'avg') aggregates[label] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
                      else if (agg.fn === 'min') aggregates[label] = nums.length ? Math.min(...nums) : null;
                      else if (agg.fn === 'max') aggregates[label] = nums.length ? Math.max(...nums) : null;
                    }
                  }
                }
                groupMetadata[key] = {
                  groupValues: Object.fromEntries(groupFields.map((f) => [f, rows[0]?.[f]])),
                  count: rows.length,
                  level: 0,
                  aggregates,
                };
              }
            }
          }

          view.data = {
            isPlain: !isGroup, isGroup, isPivot: false,
            data: result,
            ...(isGroup ? { groupFields } : {}),
            ...(groupMetadata ? { groupMetadata } : {}),
          };
          view.fire('workEnd', {
            isPlain: !isGroup, isGroup, isPivot: false,
            numRows: result.length, totalRows: rowCount,
            numGroups: isGroup ? new Set(result.map((r) => groupFields.map((f) => r[f]).join('|||'))).size : 0,
          });
          cont?.(true, view.data);
        }, data.length > 1000 ? 600 : 300);
      }, 100);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) { cont?.(true, {}); },
    setSort(spec: unknown) {
      view._sortSpec = spec as { vertical?: { field: string; dir: string } } | null;
      view.getData();
    },
    setFilter(spec: unknown) {
      view._filterSpec = spec as FilterSpec;
      view.filterSpec = spec as FilterSpec;
      view.getData();
    },
    setGroup(spec: unknown) {
      view._groupSpec = spec as GroupSpec | null;
      view.fire('groupSet', spec);
      view.getData();
    },
    setPivot(spec: unknown) {
      view.fire('pivotSet', spec);
      view.getData();
    },
    setAggregate(spec: unknown) {
      view._aggSpec = spec as AggSpec[] | null;
      view.fire('aggregateSet', spec);
      view.getData();
    },
    clearSort() {
      view._sortSpec = null;
      view.getData();
    },
    clearFilter() {
      view._filterSpec = null;
      view.filterSpec = null;
      view.getData();
    },
    clearGroup() {
      view._groupSpec = null;
      view.fire('groupSet', null);
      view.getData();
    },
    clearPivot() {
      view.fire('pivotSet', null);
      view.getData();
    },
    clearAggregate() {
      view._aggSpec = null;
      view.fire('aggregateSet', null);
      view.getData();
    },
    getSort() { return view._sortSpec; }, getAggregate() { return null; },
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
  const raw = LABELS[key];
  if (!raw) return '';
  let text = raw;
  for (const arg of args) {
    text = text.replace('%s', String(arg ?? ''));
  }
  return text;
};

const AGG_FUNCTIONS: AggregateFunction[] = [
  { name: 'sum', label: 'Sum', fieldCount: 1 },
  { name: 'avg', label: 'Average', fieldCount: 1 },
  { name: 'count', label: 'Count', fieldCount: 0 },
  { name: 'counta', label: 'Count Values', fieldCount: 1 },
  { name: 'countu', label: 'Count Unique', fieldCount: 1 },
  { name: 'min', label: 'Min', fieldCount: 1 },
  { name: 'max', label: 'Max', fieldCount: 1 },
  { name: 'list', label: 'Unique Values', fieldCount: 1 },
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
  controlFields: { field: string; displayName: string; type?: string }[];
  aggregateFields: { field: string; displayName: string }[];
}) {
  const view = useMemo(() => createMockView(data, data.length), [data]);
  const groupFnDefs = useMemo(() => getBuiltinGroupFunctions(trans), []);

  // Track the filtered data from the mock view's workEnd cycle.
  // When filters are applied, the view re-runs getData() with filtered results.
  // Track the full view data object (not just the rows) so the table
  // can switch between plain/group/pivot rendering modes.
  const initialViewData = useMemo(() => ({
    isPlain: true, isGroup: false, isPivot: false, data,
  }), [data]);
  const [viewData, setViewData] = useState(initialViewData);

  useEffect(() => {
    const handler = () => {
      const vd = (view as unknown as { data: typeof initialViewData | null }).data;
      if (vd) setViewData(vd);
    };
    view.on('workEnd', handler, { who: 'GridDemo' });
    return () => view.off('workEnd', 'GridDemo');
  }, [view, initialViewData]);

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
      groupFunctionDefs={groupFnDefs}
    >
      <TableRenderer
        viewData={viewData}
        columns={columns}
        totalRows={data.length}
        aggFnLabels={Object.fromEntries(AGG_FUNCTIONS.map((f) => [f.name, f.label]))}
        features={{
          columnResize: true,
          columnReorder: true,
          stickyHeaders: true,
          zebraStripe: true,
          keyboardNav: true,
          headerContextMenu: true,
        }}
        trans={trans}
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
    () => SIMPLE_COLUMNS.map((c) => ({ field: c.field, displayName: c.header, type: c.typeInfo?.type })),
    [],
  );
  const wideControlFields = useMemo(
    () => WIDE_COLUMNS.slice(0, 20).map((c) => ({ field: c.field, displayName: c.header, type: c.typeInfo?.type })),
    [],
  );
  const ledgerControlFields = useMemo(
    () => LEDGER_COLUMNS
      .filter((c) => !['memo', 'reference'].includes(c.field))
      .slice(0, 15)
      .map((c) => ({ field: c.field, displayName: c.header, type: c.typeInfo?.type })),
    [],
  );

  const simpleAggFields = useMemo(
    () => [
      { field: 'name', displayName: 'Name' },
      { field: 'department', displayName: 'Department' },
      { field: 'salary', displayName: 'Salary' },
      { field: 'projects', displayName: 'Projects' },
      { field: 'active', displayName: 'Active' },
      { field: 'manager', displayName: 'Manager' },
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
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">WC DataVis — Demo</h1>
          <p className="text-sm text-gray-500 mt-1">
            React table renderer with column resize, reorder, sort, sticky headers, and context menus.
          </p>
        </div>
        <a
          href="http://localhost:6006"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-pink-600 border border-pink-300 rounded-md hover:bg-pink-50 transition-colors"
          aria-label="Open Storybook"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
            <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
          </svg>
          Storybook
        </a>
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

