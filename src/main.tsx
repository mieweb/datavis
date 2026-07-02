/**
 * Demo app — three example DataGrid pages:
 *
 * 1. Simple     — 5 rows, 4 columns (employee directory)
 * 2. Wide (50c) — 20 rows, 50 columns (contact + appointment + location)
 * 3. Large (5K) — 5 000 rows, 33 columns (financial ledger + inventory)
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@mieweb/ui/components/Tabs';
import { Prefs } from 'datavis-ace';
import './index.css';
import { DataGrid } from './components/DataGrid';
import type { GridMode } from './components/DataGrid';
import { GraphView } from './components/GraphView';
import { TableRenderer } from './components/table/TableRenderer';
import type { TableColumn } from './components/table/types';
import type { ColumnFilterConfig } from './components/filters/types';
import type { GraphConfig } from './components/graph';
import { buildGroupSpec, getBuiltinGroupFunctions } from './adapters/group-adapter';
import { useDataVisEvent } from './adapters/event-bridge';
import { useView } from './adapters/use-data';
import type { PrefsInstance } from './adapters/use-prefs';
import { E2EHarnessApp, isE2EMode } from './testing/E2EHarnessApp';
import { createMockView, DEMO_AGG_FUNCTIONS, demoTrans } from './demo/mock-grid';
import { LanguageSelector } from './components/LanguageSelector';
import { toLegacyAggregateSpec } from './adapters/wcdatavis-interop';

import {
  SIMPLE_DATA, SIMPLE_COLUMNS, SIMPLE_FILTERS,
  generateWideData, WIDE_COLUMNS, WIDE_FILTERS,
  generateLedgerData, LEDGER_COLUMNS, LEDGER_FILTERS,
} from './demo/data';

// ───────────────────────────────────────────────────────────
// Tab definitions
// ───────────────────────────────────────────────────────────

type TabKey = 'simple' | 'wide' | 'large' | 'constrained' | 'graph-only';

interface TabDef {
  key: TabKey;
  label: string;
  badge: string;
}

const TABS: TabDef[] = [
  { key: 'simple', label: 'Simple', badge: '8 rows × 8 cols' },
  { key: 'wide', label: 'Wide (50 columns)', badge: '20 rows × 50 cols' },
  { key: 'large', label: 'Large (5K rows)', badge: '5 000 rows × 33 cols' },
  { key: 'constrained', label: 'Constrained', badge: '500px container' },
  { key: 'graph-only', label: 'Graph Only', badge: 'Grouped average(salary)' },
];

const DEFAULT_GRAPH_CONFIGS: Record<TabKey, Partial<GraphConfig>> = {
  simple: { chartType: 'bar' },
  wide: { chartType: 'bar' },
  large: { chartType: 'bar' },
  constrained: { chartType: 'bar' },
  'graph-only': { chartType: 'bar', xField: 'department' },
};

const PREFS_LOCAL_STORAGE_KEY = 'WC_DataVis_NITRO_Prefs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveCurrentPerspective(prefs: PrefsInstance): { id: string; config?: unknown } | null {
  if (prefs.currentPerspective?.id) {
    return prefs.currentPerspective;
  }

  if (typeof prefs.getCurrentPerspective === 'function') {
    const current = prefs.getCurrentPerspective();
    if (current?.id) {
      return current;
    }
  }

  return null;
}

function readGraphConfigFromPerspective(prefs: PrefsInstance): Partial<GraphConfig> | null {
  const current = resolveCurrentPerspective(prefs);
  if (!current?.id) return null;

  const perspectiveConfig = prefs.perspectives?.[current.id]?.config;
  const config = isRecord(perspectiveConfig)
    ? perspectiveConfig
    : (isRecord(current.config) ? current.config : null);
  if (!config) return null;

  const graph = config.graph;
  return isRecord(graph) ? (graph as Partial<GraphConfig>) : null;
}

function writeGraphConfigToPerspective(prefs: PrefsInstance, graphConfig: Partial<GraphConfig>): void {
  const current = resolveCurrentPerspective(prefs);
  if (!current?.id) return;

  const mappedPerspectiveConfig = prefs.perspectives?.[current.id]?.config;
  const currentConfig = isRecord(mappedPerspectiveConfig)
    ? mappedPerspectiveConfig
    : (isRecord(current.config) ? current.config : {});
  const existingGraph = currentConfig.graph;
  const existingSerialized = JSON.stringify(existingGraph ?? null);
  const nextSerialized = JSON.stringify(graphConfig ?? null);
  if (existingSerialized === nextSerialized) return;

  const nextConfig = {
    ...currentConfig,
    graph: graphConfig,
  };

  current.config = nextConfig;

  const perspectiveMap = prefs.perspectives;
  if (perspectiveMap && perspectiveMap[current.id]) {
    perspectiveMap[current.id].config = nextConfig;
  }

  if (prefs.currentPerspective?.id === current.id) {
    prefs.currentPerspective.config = nextConfig;
  }

  if (typeof prefs.reallySave === 'function') {
    prefs.reallySave();
    return;
  }

  prefs.save?.();
}

function readGraphConfigFromPrefsStorage(prefsName: string): Partial<GraphConfig> | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(PREFS_LOCAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const store = JSON.parse(raw) as Record<string, unknown>;
    const scope = store[prefsName];
    if (!isRecord(scope)) return null;

    const currentId = scope.current;
    if (typeof currentId !== 'string') return null;

    const perspectives = scope.perspectives;
    if (!isRecord(perspectives)) return null;

    const perspective = perspectives[currentId];
    if (!isRecord(perspective)) return null;

    const config = perspective.config;
    if (!isRecord(config)) return null;

    const graph = config.graph;
    return isRecord(graph) ? (graph as Partial<GraphConfig>) : null;
  } catch {
    return null;
  }
}

function writeGraphConfigToPrefsStorage(prefsName: string, graphConfig: Partial<GraphConfig>): void {
  if (typeof window === 'undefined') return;

  const raw = window.localStorage.getItem(PREFS_LOCAL_STORAGE_KEY);
  if (!raw) return;

  try {
    const store = JSON.parse(raw) as Record<string, unknown>;
    const scope = store[prefsName];
    if (!isRecord(scope)) return;

    const currentId = scope.current;
    if (typeof currentId !== 'string') return;

    const perspectives = scope.perspectives;
    if (!isRecord(perspectives)) return;

    const perspective = perspectives[currentId];
    if (!isRecord(perspective)) return;

    const config = isRecord(perspective.config) ? perspective.config : {};
    const existingSerialized = JSON.stringify(config.graph ?? null);
    const nextSerialized = JSON.stringify(graphConfig ?? null);
    if (existingSerialized === nextSerialized) return;

    perspective.config = {
      ...config,
      graph: graphConfig,
    };

    window.localStorage.setItem(PREFS_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // no-op: storage payload might be unavailable while prefs initializes
  }
}

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
  graphConfig,
  onGraphConfigChange,
  defaultGraphConfig,
  height,
  mode,
}: {
  title: string;
  helpText: string;
  data: Record<string, unknown>[];
  columns: TableColumn[];
  filters: ColumnFilterConfig[];
  controlFields: { field: string; displayName: string; type?: string }[];
  aggregateFields: { field: string; displayName: string }[];
  graphConfig: Partial<GraphConfig>;
  onGraphConfigChange: (config: Partial<GraphConfig>) => void;
  defaultGraphConfig: Partial<GraphConfig>;
  height?: string;
  mode?: GridMode;
}) {
  const view = useMemo(() => createMockView(data, columns), [columns, data]);
  const groupFnDefs = useMemo(() => getBuiltinGroupFunctions(demoTrans), []);
  const prefsName = useMemo(() => {
    const prefsSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `nitro-demo:${prefsSlug || 'grid'}`;
  }, [title]);
  const prefs = useMemo(() => {
    const nextPrefs = new Prefs(prefsName, null, {
      autoSave: true,
      backend: {
        type: 'localStorage',
        localStorage: {
          key: 'WC_DataVis_NITRO_Prefs',
        },
      },
    }) as unknown as PrefsInstance;

    view.setPrefs(nextPrefs);
    return nextPrefs;
  }, [prefsName, view]);
  const viewState = useView(view);
  const graphConfigHydratedRef = useRef(false);

  const onGraphConfigChangeRef = useRef(onGraphConfigChange);

  useEffect(() => {
    onGraphConfigChangeRef.current = onGraphConfigChange;
  }, [onGraphConfigChange]);
  const syncGraphConfigFromPerspective = useCallback(() => {
    const persisted = readGraphConfigFromPerspective(prefs)
      ?? readGraphConfigFromPrefsStorage(prefsName);
    const next = persisted ?? defaultGraphConfig;
    graphConfigHydratedRef.current = true;
    onGraphConfigChangeRef.current({ ...next });
  }, [defaultGraphConfig, prefs, prefsName]);

  useEffect(() => {
    if (typeof prefs.prime !== 'function') {
      syncGraphConfigFromPerspective();
      return;
    }

    prefs.prime();
    syncGraphConfigFromPerspective();
  }, [prefs, syncGraphConfigFromPerspective]);

  useDataVisEvent(prefs, 'primed', syncGraphConfigFromPerspective);
  useDataVisEvent(prefs, 'perspectiveChanged', syncGraphConfigFromPerspective);

  useEffect(() => {
    if (!graphConfigHydratedRef.current) return;
    writeGraphConfigToPerspective(prefs, graphConfig);
    writeGraphConfigToPrefsStorage(prefsName, graphConfig);
  }, [graphConfig, prefs, prefsName]);

  return (
    <div className="space-y-4">
      <GraphView
        viewData={viewState.data}
        columns={columns}
        config={graphConfig}
        onConfigChange={onGraphConfigChange}
      />

      <DataGrid
        view={view}
        prefs={prefs}
        title={title}
        helpText={helpText}
        height={height}
        mode={mode}
        showToolbar={true}
        showControls={true}
        debug={true}
        filterColumns={filters}
        allColumns={columns}
        controlFields={controlFields}
        aggregateFields={aggregateFields}
        aggregateFunctions={DEMO_AGG_FUNCTIONS}
        groupFunctionDefs={groupFnDefs}
      >
        <TableRenderer
          viewData={viewState.data}
          columns={columns}
          totalRows={data.length}
          aggFnLabels={Object.fromEntries(DEMO_AGG_FUNCTIONS.map((f) => [f.name, f.label]))}
          features={{
            columnResize: true,
            columnReorder: true,
            stickyHeaders: true,
            zebraStripe: true,
            keyboardNav: true,
            headerContextMenu: true,
          }}
          onRowClick={(row) => console.log('Row clicked:', row.data)}
        />
      </DataGrid>
    </div>
  );
}

function GraphOnlyDemo({
  title,
  helpText,
  data,
  columns,
  graphConfig,
  onGraphConfigChange,
}: {
  title: string;
  helpText: string;
  data: Record<string, unknown>[];
  columns: TableColumn[];
  graphConfig: Partial<GraphConfig>;
  onGraphConfigChange: (config: Partial<GraphConfig>) => void;
}) {
  const view = useMemo(() => createMockView(data, columns), [columns, data]);
  const viewState = useView(view, false);
  const averageAggregateName = useMemo(
    () => DEMO_AGG_FUNCTIONS.find((fn) => fn.name === 'average' || fn.name === 'avg' || fn.label.toLowerCase().includes('average'))?.name ?? 'average',
    [],
  );
  useEffect(() => {
    view.setGroup(buildGroupSpec([{ field: 'department' }]));
    view.setAggregate(toLegacyAggregateSpec([{ fn: averageAggregateName, fields: ['salary'] }]));
    view.getData();
  }, [averageAggregateName, view]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{helpText}</p>
      </section>

      <GraphView
        viewData={viewState.data}
        columns={columns}
        config={graphConfig}
        onConfigChange={onGraphConfigChange}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// App — tabbed demo
// ───────────────────────────────────────────────────────────

function getTabFromHash(): TabKey {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'wide' || hash === 'large' || hash === 'constrained' || hash === 'graph-only') return hash;
  return 'simple';
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(getTabFromHash);
  const [graphConfigs, setGraphConfigs] = useState<Record<TabKey, Partial<GraphConfig>>>(DEFAULT_GRAPH_CONFIGS);
  const [mode, setMode] = useState<GridMode>('default');

  const handleGraphConfigChange = (tab: TabKey, config: Partial<GraphConfig>) => {
    setGraphConfigs((prev) => ({
      ...prev,
      [tab]: config,
    }));
  };

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
          <h1 className="text-xl font-bold text-gray-800">DataVis NITRO — Demo</h1>
          <p className="text-sm text-gray-500 mt-1">
            React grid demo with live table and graph exploration across plain, grouped, and pivoted outputs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <span>Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GridMode)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              aria-label="Grid display mode"
            >
              <option value="default">Default</option>
              <option value="full">Full</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <LanguageSelector />
          {location.hostname === 'localhost' && <a
            href="http://localhost:6006"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-pink-600 border border-pink-300 rounded-md hover:bg-pink-50 transition-colors"
            aria-label="Open Storybook"
          >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          Storybook
        </a>}
        </div>
      </header>

      {/* Tab bar */}
      <div
        className="bg-white border-b border-gray-200 px-6"
      >
        <Tabs value={activeTab} onValueChange={(value) => switchTab(value as TabKey)} variant="underline">
          <TabsList aria-label="Demo examples" className="flex gap-0">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="px-4 py-3 text-sm font-medium"
            >
              {tab.label}
              <span className="ml-2 text-xs font-normal text-gray-400">{tab.badge}</span>
            </TabsTrigger>
          ))}
          </TabsList>
        </Tabs>
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
            graphConfig={graphConfigs.simple}
            onGraphConfigChange={(config) => handleGraphConfigChange('simple', config)}
              defaultGraphConfig={DEFAULT_GRAPH_CONFIGS.simple}
            mode={mode}
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
            graphConfig={graphConfigs.wide}
            onGraphConfigChange={(config) => handleGraphConfigChange('wide', config)}
              defaultGraphConfig={DEFAULT_GRAPH_CONFIGS.wide}
            mode={mode}
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
            graphConfig={graphConfigs.large}
            onGraphConfigChange={(config) => handleGraphConfigChange('large', config)}
              defaultGraphConfig={DEFAULT_GRAPH_CONFIGS.large}
            mode={mode}
          />
        )}

        {activeTab === 'constrained' && (
            <GridDemo
              title="Constrained Container — 500px"
              helpText="Same 5K-row ledger inside a fixed 500px container. Sticky headers work within the container's scroll area."
              data={ledgerData}
              columns={LEDGER_COLUMNS}
              filters={LEDGER_FILTERS}
              controlFields={ledgerControlFields}
              aggregateFields={ledgerAggFields}
              graphConfig={graphConfigs.constrained}
              onGraphConfigChange={(config) => handleGraphConfigChange('constrained', config)}
                defaultGraphConfig={DEFAULT_GRAPH_CONFIGS.constrained}
              height="500px"
              mode={mode}
            />
        )}

        {activeTab === 'graph-only' && (
          <GraphOnlyDemo
            title="Graph Only — Grouped by Department"
            helpText="Standalone graph configured in code with no grid/table. Data is grouped by department and displays average(salary)."
            data={SIMPLE_DATA}
            columns={SIMPLE_COLUMNS}
            graphConfig={graphConfigs['graph-only']}
            onGraphConfigChange={(config) => handleGraphConfigChange('graph-only', config)}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  isE2EMode() ? <E2EHarnessApp /> : <App />,
);

