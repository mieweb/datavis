/**
 * useSource — React hook wrapping wcdatavis Source construction and lifecycle.
 *
 * Provides reactive state for data fetching progress and type information,
 * abstracting away the callback-based Source API.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDataVisEvents, type EventEmitter } from './event-bridge';

// ───────────────────────────────────────────────────────────
// Types (mirrors wcdatavis Source API shapes)
// ───────────────────────────────────────────────────────────

/** wcdatavis Source constructor spec */
export interface SourceSpec {
  type: 'local' | 'http' | 'file' | 'table';
  [key: string]: unknown;
}

/** A single CGI parameter input */
export interface ParamInput {
  name: string;
  value: string | string[];
  [key: string]: unknown;
}

/** Source instance (from wcdatavis core) */
export interface SourceInstance extends EventEmitter {
  getData(cont: (ok: boolean, data: unknown) => void): void;
  getTypeInfo(cont: (ok: boolean, typeInfo: unknown) => void): void;
  getUniqueVals(cont: (ok: boolean, vals: unknown) => void): void;
  getDisplayName(cont: (ok: boolean, name: string) => void): void;
  clearCachedData(): void;
  refresh(): void;
  cancel(): void;
  isCancellable(): boolean;
  swapRows(oldIdx: number, newIdx: number): void;
  setToolbar(toolbar: unknown): void;
}

/** ComputedView instance (from wcdatavis core) */
export interface ViewInstance extends EventEmitter {
  source: SourceInstance;
  data: ViewData | null;
  typeInfo: unknown;

  getData(cont?: (ok: boolean, data: unknown) => void, reason?: string): void;
  getTypeInfo(cont?: (ok: boolean, typeInfo: unknown) => void): void;

  setSort(spec: unknown, opts?: Record<string, unknown>): void;
  setFilter(spec: unknown, opts?: Record<string, unknown>): void;
  setGroup(spec: unknown, opts?: Record<string, unknown>): void;
  setPivot(spec: unknown, opts?: Record<string, unknown>): void;
  setAggregate(spec: unknown, opts?: Record<string, unknown>): void;

  clearSort(opts?: Record<string, unknown>): void;
  clearFilter(opts?: Record<string, unknown>): void;
  clearGroup(opts?: Record<string, unknown>): void;
  clearPivot(opts?: Record<string, unknown>): void;
  clearAggregate(opts?: Record<string, unknown>): void;

  getSort(): unknown;
  getAggregate(): unknown;

  getRowCount(): number;
  getTotalRowCount(): number;

  clearCache(): void;
  refresh(): void;
  reset(opts?: Record<string, unknown>): void;

  setColConfig(colConfig: unknown): void;
  setPrefs(prefs: unknown): void;

  unlimit(): void;

  getUniqueVals(cont: (ok: boolean, vals: unknown) => void): void;
}

/** View data shape — matches View~Data from wcdatavis */
export interface ViewData {
  isPlain: boolean;
  isGroup: boolean;
  isPivot: boolean;
  data: unknown[];
  dataByRowId?: Record<string, unknown>;
  rowVals?: unknown[];
  colVals?: unknown[];
  groupFields?: string[];
  pivotFields?: string[];
  groupMetadata?: unknown;
  agg?: unknown;
}

/** WorkEnd info from ComputedView */
export interface WorkEndInfo {
  isPlain: boolean;
  isGroup: boolean;
  isPivot: boolean;
  numRows: number;
  totalRows: number;
  numGroups: number;
}

// ───────────────────────────────────────────────────────────
// useSource hook
// ───────────────────────────────────────────────────────────

export interface UseSourceState {
  /** Whether the source is currently fetching data */
  fetching: boolean;
  /** Whether the fetch was cancelled */
  cancelled: boolean;
  /** Type information from the source (OrdMap) */
  typeInfo: unknown | null;
  /** Error state */
  error: string | null;
}

export interface UseSourceReturn extends UseSourceState {
  /** The underlying Source instance */
  source: SourceInstance;
  /** Refresh the data source */
  refresh: () => void;
  /** Cancel an in-progress fetch */
  cancel: () => void;
}

/**
 * React hook that wraps a wcdatavis Source instance with reactive state.
 *
 * @param source - An already-constructed Source instance from wcdatavis core.
 *
 * @example
 * ```tsx
 * const source = useMemo(() => new Source(spec, params), []);
 * const { fetching, typeInfo, refresh, cancel } = useSource(source);
 * ```
 */
export function useSource(source: SourceInstance): UseSourceReturn {
  const [state, setState] = useState<UseSourceState>({
    fetching: false,
    cancelled: false,
    typeInfo: null,
    error: null,
  });

  useDataVisEvents(source, {
    fetchDataBegin: () => {
      setState((s) => ({ ...s, fetching: true, cancelled: false, error: null }));
    },
    fetchDataEnd: () => {
      setState((s) => ({ ...s, fetching: false }));
    },
    fetchDataCancel: () => {
      setState((s) => ({ ...s, fetching: false, cancelled: true }));
    },
    getTypeInfo: (typeInfo: unknown) => {
      setState((s) => ({ ...s, typeInfo }));
    },
  });

  const refresh = useCallback(() => source.refresh(), [source]);
  const cancel = useCallback(() => source.cancel(), [source]);

  return {
    ...state,
    source,
    refresh,
    cancel,
  };
}

// ───────────────────────────────────────────────────────────
// useView hook
// ───────────────────────────────────────────────────────────

export interface UseViewState {
  /** Whether the view is currently processing data */
  loading: boolean;
  /** Whether data has been loaded at least once */
  ready: boolean;
  /** The processed view data */
  data: ViewData | null;
  /** Type information */
  typeInfo: unknown | null;
  /** Work-end summary info */
  workInfo: WorkEndInfo | null;
  /** Source is fetching */
  fetching: boolean;
}

export interface UseViewReturn extends UseViewState {
  /** The underlying ComputedView instance */
  view: ViewInstance;
  /** Request fresh data from the source */
  refresh: () => void;
  /** Reset all view specs (sort, filter, group, pivot, aggregate) */
  reset: () => void;
  /** Set sort configuration */
  setSort: (spec: unknown) => void;
  /** Set filter configuration */
  setFilter: (spec: unknown) => void;
  /** Set group configuration */
  setGroup: (spec: unknown) => void;
  /** Set pivot configuration */
  setPivot: (spec: unknown) => void;
  /** Set aggregate configuration */
  setAggregate: (spec: unknown) => void;
  /** Clear filter */
  clearFilter: () => void;
  /** Clear group */
  clearGroup: () => void;
  /** Clear sort */
  clearSort: () => void;
  /** Get row count */
  rowCount: number;
  /** Get total row count (before filter) */
  totalRowCount: number;
}

/**
 * React hook that wraps a wcdatavis ComputedView with reactive state.
 *
 * @param view - An already-constructed ComputedView instance.
 * @param autoFetch - If true (default), calls `view.getData()` on mount.
 *
 * @example
 * ```tsx
 * const view = useMemo(() => new ComputedView(source), [source]);
 * const { loading, data, setSort, setFilter } = useView(view);
 * ```
 */
export function useView(view: ViewInstance, autoFetch = true): UseViewReturn {
  const [state, setState] = useState<UseViewState>({
    loading: false,
    ready: false,
    data: null,
    typeInfo: null,
    workInfo: null,
    fetching: false,
  });

  useDataVisEvents(view, {
    fetchDataBegin: () => {
      setState((s) => ({ ...s, fetching: true }));
    },
    fetchDataEnd: () => {
      setState((s) => ({ ...s, fetching: false }));
    },
    workBegin: () => {
      setState((s) => ({ ...s, loading: true }));
    },
    workEnd: (info: unknown) => {
      setState((s) => ({
        ...s,
        loading: false,
        ready: true,
        data: view.data,
        workInfo: info as WorkEndInfo,
      }));
    },
    getTypeInfo: (typeInfo: unknown) => {
      setState((s) => ({ ...s, typeInfo }));
    },
    dataUpdated: () => {
      // Source has new data — view will re-process
      setState((s) => ({ ...s, loading: true }));
    },
  });

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      view.getData();
    }
  }, [view, autoFetch]);

  const refresh = useCallback(() => view.refresh(), [view]);
  const reset = useCallback(() => view.reset(), [view]);
  const setSort = useCallback((spec: unknown) => view.setSort(spec), [view]);
  const setFilter = useCallback((spec: unknown) => view.setFilter(spec), [view]);
  const setGroup = useCallback((spec: unknown) => view.setGroup(spec), [view]);
  const setPivot = useCallback((spec: unknown) => view.setPivot(spec), [view]);
  const setAggregate = useCallback((spec: unknown) => view.setAggregate(spec), [view]);
  const clearFilter = useCallback(() => view.clearFilter(), [view]);
  const clearGroup = useCallback(() => view.clearGroup(), [view]);
  const clearSort = useCallback(() => view.clearSort(), [view]);

  return {
    ...state,
    view,
    refresh,
    reset,
    setSort,
    setFilter,
    setGroup,
    setPivot,
    setAggregate,
    clearFilter,
    clearGroup,
    clearSort,
    rowCount: view.getRowCount?.() ?? 0,
    totalRowCount: view.getTotalRowCount?.() ?? 0,
  };
}
