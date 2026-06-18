/**
 * Sales perspectives demo — a solo example page that shows how DataVis NITRO
 * ships default grid configurations and persists user perspectives through the
 * a3t universal asset loader.
 *
 * On load we:
 *   1. Register the a3t-backed Prefs backend.
 *   2. Seed the out-of-the-box sales perspectives (idempotent).
 *   3. Wire a single DataGrid + GraphView to a Prefs instance using that
 *      backend, so switching/saving perspectives round-trips through a3t.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Prefs } from 'datavis-ace';
import './index.css';
import { DataGrid } from './components/DataGrid';
import { GraphView } from './components/GraphView';
import { TableRenderer } from './components/table/TableRenderer';
import type { GraphConfig } from './components/graph';
import { getBuiltinGroupFunctions } from './adapters/group-adapter';
import { useDataVisEvent } from './adapters/event-bridge';
import { useView } from './adapters/use-data';
import type { PrefsInstance } from './adapters/use-prefs';
import { createMockView, DEMO_AGG_FUNCTIONS, demoTrans } from './demo/mock-grid';
import { LanguageSelector } from './components/LanguageSelector';
import {
  generateSalesData,
  SALES_COLUMNS,
  SALES_FILTERS,
  SALES_CONTROL_FIELDS,
  SALES_AGGREGATE_FIELDS,
} from './demo/sales-data';
import {
  SALES_PERSPECTIVE_BLOB,
  SALES_PREFS_ID,
} from './demo/sales-perspectives';
import {
  registerA3tPrefsBackend,
  seedPerspectiveDefaults,
  resetPerspectiveToDefault,
  loadSeededPerspective,
  getPerspectiveMeta,
  A3T_PREFS_BACKEND_TYPE,
  type PerspectiveMeta,
} from './adapters/a3t-prefs-backend';

// ───────────────────────────────────────────────────────────
// Graph-config persistence (stored inside the active perspective)
// ───────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function currentPerspectiveId(prefs: PrefsInstance): string | null {
  return prefs.currentPerspective?.id ?? prefs.getCurrentPerspective?.()?.id ?? null;
}

function readGraphConfig(prefs: PrefsInstance): Partial<GraphConfig> | null {
  const id = currentPerspectiveId(prefs);
  if (!id) return null;
  const config = prefs.perspectives?.[id]?.config;
  const graph = isRecord(config) ? config.graph : null;
  return isRecord(graph) ? (graph as Partial<GraphConfig>) : null;
}

function writeGraphConfig(prefs: PrefsInstance, graphConfig: Partial<GraphConfig>): void {
  const id = currentPerspectiveId(prefs);
  if (!id) return;

  const perspective = prefs.perspectives?.[id];
  const config = isRecord(perspective?.config) ? perspective.config : {};
  if (JSON.stringify(config.graph ?? null) === JSON.stringify(graphConfig ?? null)) return;

  const nextConfig = { ...config, graph: graphConfig };
  if (perspective) perspective.config = nextConfig;
  if (prefs.currentPerspective?.id === id) prefs.currentPerspective.config = nextConfig;

  if (typeof prefs.reallySave === 'function') {
    prefs.reallySave();
  } else {
    prefs.save?.();
  }
}

// ───────────────────────────────────────────────────────────
// Perspective source strip — surfaces copy-on-write status
// ───────────────────────────────────────────────────────────

type PerspectiveStatus = 'default' | 'modified' | 'custom';

function classifyPerspective(meta: PerspectiveMeta | null, id: string | null): PerspectiveStatus | null {
  if (!meta || !id) return null;
  if (!meta.defaults.includes(id)) return 'custom';
  return meta.overridden.includes(id) ? 'modified' : 'default';
}

const STATUS_LABELS: Record<PerspectiveStatus, string> = {
  default: 'Shipped default',
  modified: 'Modified default',
  custom: 'Your perspective',
};

/**
 * Shows whether the active perspective is a shipped default, a modified
 * default (copy-on-write override), or a user-created one — and offers
 * "Reset to default" to restore the shipped version of a modified default.
 */
function PerspectiveSource({
  status,
  onReset,
  resetting,
}: {
  status: PerspectiveStatus | null;
  onReset: () => void;
  resetting: boolean;
}) {
  if (!status) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
    >
      <span className="text-gray-700">
        Perspective source: <span className="font-medium text-gray-900">{STATUS_LABELS[status]}</span>
        {status === 'modified' && (
          <span className="ml-1 text-gray-500">— the original shipped version is preserved.</span>
        )}
      </span>
      {status === 'modified' && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
        >
          {resetting ? 'Resetting…' : 'Reset to default'}
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Sales grid — bound to the a3t Prefs backend
// ───────────────────────────────────────────────────────────

function SalesGrid() {
  const data = useMemo(() => generateSalesData(), []);
  const view = useMemo(() => createMockView(data, SALES_COLUMNS), [data]);
  const groupFnDefs = useMemo(() => getBuiltinGroupFunctions(demoTrans), []);

  const prefs = useMemo(() => {
    const nextPrefs = new Prefs(SALES_PREFS_ID, null, {
      autoSave: true,
      backend: { type: A3T_PREFS_BACKEND_TYPE, [A3T_PREFS_BACKEND_TYPE]: {} },
    }) as unknown as PrefsInstance;
    view.setPrefs(nextPrefs);
    return nextPrefs;
  }, [view]);

  const viewState = useView(view);
  const [graphConfig, setGraphConfig] = useState<Partial<GraphConfig>>({ chartType: 'line' });
  // True only after a genuine user graph edit, so hydration/init never persists
  // (which would spuriously fork a shipped default via copy-on-write).
  const userEditedGraphRef = useRef(false);
  const [meta, setMeta] = useState<PerspectiveMeta | null>(null);
  const [resetting, setResetting] = useState(false);

  const refreshMeta = useCallback(() => {
    getPerspectiveMeta(SALES_PREFS_ID)
      .then(setMeta)
      .catch(() => undefined);
  }, []);

  const syncGraphFromPerspective = useCallback(() => {
    userEditedGraphRef.current = false;
    setGraphConfig({ ...(readGraphConfig(prefs) ?? { chartType: 'line' }) });
    refreshMeta();
  }, [prefs, refreshMeta]);

  const handleGraphConfigChange = useCallback((next: Partial<GraphConfig>) => {
    userEditedGraphRef.current = true;
    setGraphConfig(next);
  }, []);

  useEffect(() => {
    prefs.prime?.();
    syncGraphFromPerspective();
  }, [prefs, syncGraphFromPerspective]);

  useDataVisEvent(prefs, 'primed', syncGraphFromPerspective);
  useDataVisEvent(prefs, 'perspectiveChanged', syncGraphFromPerspective);
  useDataVisEvent(prefs, 'prefsSaved', refreshMeta);

  useEffect(() => {
    if (!userEditedGraphRef.current) return;
    writeGraphConfig(prefs, graphConfig);
  }, [graphConfig, prefs]);

  const currentId = currentPerspectiveId(prefs);
  const status = classifyPerspective(meta, currentId);

  const handleReset = useCallback(() => {
    if (!currentId) return;
    setResetting(true);
    resetPerspectiveToDefault(SALES_PREFS_ID, currentId)
      .then(() => loadSeededPerspective(SALES_PREFS_ID, currentId))
      .then((restored) => {
        // `prime()` is a no-op once already primed, so the in-memory perspective still
        // holds the modified config. Swap in the freshly-resolved shipped default and
        // re-apply it via setCurrentPerspective, which fires `perspectiveChanged` to
        // recompute the grid and sync the graph — no page refresh required.
        const perspective = prefs.perspectives?.[currentId];
        if (restored?.config && perspective) {
          perspective.config = restored.config;
          if (prefs.currentPerspective?.id === currentId) {
            prefs.currentPerspective.config = restored.config;
          }
        }
        prefs.setCurrentPerspective(currentId);
        syncGraphFromPerspective();
      })
      .catch(() => undefined)
      .finally(() => setResetting(false));
  }, [currentId, prefs, syncGraphFromPerspective]);

  return (
    <div className="space-y-4">
      <PerspectiveSource status={status} onReset={handleReset} resetting={resetting} />

      <GraphView
        viewData={viewState.data}
        columns={SALES_COLUMNS}
        config={graphConfig}
        onConfigChange={handleGraphConfigChange}
      />

      <DataGrid
        view={view}
        prefs={prefs}
        title="Sales Performance"
        helpText="Switch between shipped perspectives or save your own — all persisted through a3t."
        showToolbar={true}
        showControls={true}
        debug={true}
        filterColumns={SALES_FILTERS}
        allColumns={SALES_COLUMNS}
        controlFields={SALES_CONTROL_FIELDS}
        aggregateFields={SALES_AGGREGATE_FIELDS}
        aggregateFunctions={DEMO_AGG_FUNCTIONS}
        groupFunctionDefs={groupFnDefs}
      >
        <TableRenderer
          viewData={viewState.data}
          columns={SALES_COLUMNS}
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
        />
      </DataGrid>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// App shell — seeds defaults before rendering the grid
// ───────────────────────────────────────────────────────────

function SalesApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    registerA3tPrefsBackend();
    seedPerspectiveDefaults(SALES_PREFS_ID, SALES_PERSPECTIVE_BLOB)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Perspectives</h1>
          <p className="mt-1 text-sm text-gray-600">
            Default grid configurations seeded and saved through a3t.
          </p>
        </div>
        <LanguageSelector />
      </header>

      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load perspectives: {error}
        </div>
      ) : ready ? (
        <SalesGrid />
      ) : (
        <div role="status" aria-live="polite" className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading perspectives…
        </div>
      )}
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<SalesApp />);
}
