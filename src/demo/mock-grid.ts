import type { ViewInstance, ViewData, SourceInstance } from '../adapters/use-data';
import type { GroupSpec } from '../adapters/group-adapter';
import type { AggregateFunction } from '../components/controls/AggregateSection';
import type { FilterSpec } from '../components/filters/types';
import { applyFilter } from '../components/filters/apply-filter';
import {
  buildGroupMetadata,
  buildPivotData,
  computeAggregateMap,
  sortRows,
  type AggregateSpec,
  type ViewSortSpec,
} from '../adapters/view-transforms';
import enUsTsv from '../i18n/en-US.tsv?raw';

export interface MockView extends ViewInstance {
  _filterSpec: FilterSpec | null;
  filterSpec: FilterSpec | null;
  _sortSpec: ViewSortSpec | null;
  _groupSpec: GroupSpec | null;
  _pivotSpec: GroupSpec | null;
  _aggSpec: AggregateSpec[] | null;
}

export function createMockSource(): SourceInstance {
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};
  return {
    on(event: string, cb: (...args: unknown[]) => void, opts?: { who?: unknown }) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ cb, who: opts?.who });
    },
    off(event: string, who: unknown) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((listener) => listener.who !== who);
    },
    fire(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((listener) => listener.cb(...args));
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

export function createMockView(data: Record<string, unknown>[], rowCount: number): MockView {
  const source = createMockSource();
  const listeners: Record<string, Array<{ cb: (...args: unknown[]) => void; who: unknown }>> = {};

  const view = {
    source,
    data: null as ViewData | null,
    typeInfo: null,
    filterSpec: null as FilterSpec | null,
    _filterSpec: null as FilterSpec | null,
    _sortSpec: null as ViewSortSpec | null,
    _groupSpec: null as GroupSpec | null,
    _pivotSpec: null as GroupSpec | null,
    _aggSpec: null as AggregateSpec[] | null,
    on(event: string, cb: (...args: unknown[]) => void, opts?: { who?: unknown }) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push({ cb, who: opts?.who });
    },
    off(event: string, who: unknown) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((listener) => listener.who !== who);
    },
    fire(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((listener) => listener.cb(...args));
    },
    getData(cont?: (ok: boolean, d: unknown) => void) {
      setTimeout(() => {
        view.fire('workBegin');
        setTimeout(() => {
          const filteredRows = view._filterSpec ? applyFilter(data, view._filterSpec) : [...data];
          const result = sortRows(filteredRows, view._sortSpec);

          const groupFields = (view._groupSpec?.fieldNames ?? []).map((fieldInfo) => fieldInfo.field);
          const pivotFields = (view._pivotSpec?.fieldNames ?? []).map((fieldInfo) => fieldInfo.field);
          const isPivot = pivotFields.length > 0;
          const isGroup = groupFields.length > 0 || isPivot;
          const { groupMetadata, numGroups } = buildGroupMetadata(result, view._groupSpec, view._aggSpec);
          const pivotData = buildPivotData(result, view._groupSpec, view._pivotSpec, view._aggSpec);

          const totalAggregates = view._aggSpec?.length ? computeAggregateMap(result, view._aggSpec) : undefined;

          view.data = {
            isPlain: !isGroup,
            isGroup: groupFields.length > 0,
            isPivot,
            data: isPivot ? (pivotData?.matrix ?? []) : result,
            ...(groupFields.length > 0 ? { groupFields } : {}),
            ...(isPivot
              ? {
                  groupFields,
                  pivotFields,
                  rowVals: pivotData?.rowVals ?? [],
                  colVals: pivotData?.colVals ?? [],
                  agg: pivotData?.aggSpecs ?? view._aggSpec ?? [],
                  totalCol: pivotData?.totalCol ?? [],
                  totalRow: pivotData?.totalRow ?? [],
                  grandTotal: pivotData?.grandTotal ?? {},
                }
              : {}),
            ...(groupMetadata ? { groupMetadata } : {}),
            ...(totalAggregates ? { totalAggregates } : {}),
          } as ViewData;

          view.fire('workEnd', {
            isPlain: !isGroup,
            isGroup: groupFields.length > 0,
            isPivot,
            numRows: isPivot ? (pivotData?.rowVals.length ?? 0) : result.length,
            totalRows: rowCount,
            numGroups: isPivot ? (pivotData?.rowVals.length ?? 0) : numGroups,
          });
          cont?.(true, view.data);
        }, data.length > 1000 ? 600 : 300);
      }, 100);
    },
    getTypeInfo(cont?: (ok: boolean, ti: unknown) => void) { cont?.(true, {}); },
    setSort(spec: unknown) {
      view._sortSpec = spec as ViewSortSpec | null;
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
      view._pivotSpec = spec as GroupSpec | null;
      view.fire('pivotSet', spec);
      view.getData();
    },
    setAggregate(spec: unknown) {
      view._aggSpec = spec as AggregateSpec[] | null;
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
      view._pivotSpec = null;
      view.fire('pivotSet', null);
      view.getData();
    },
    clearAggregate() {
      view._aggSpec = null;
      view.fire('aggregateSet', null);
      view.getData();
    },
    getSort() { return view._sortSpec; },
    getAggregate() { return null; },
    getRowCount() {
      const currentData = view.data as { data?: unknown[] } | null;
      return currentData?.data?.length ?? rowCount;
    },
    getTotalRowCount() { return rowCount; },
    clearCache() {},
    refresh() { view.getData(); },
    reset() {},
    setColConfig() {},
    setPrefs() {},
    unlimit() {},
    getUniqueVals(cont: (ok: boolean, vals: unknown) => void) { cont(true, {}); },
  } as unknown as MockView;

  return view;
}

export function parseTsv(raw: string): Record<string, string> {
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

export const demoTrans = (key: string, ...args: unknown[]): string => {
  const raw = LABELS[key];
  if (!raw) return '';
  let text = raw;
  for (const arg of args) {
    text = text.replace('%s', String(arg ?? ''));
  }
  return text;
};

export const DEMO_AGG_FUNCTIONS: AggregateFunction[] = [
  { name: 'sum', label: 'Sum', fieldCount: 1 },
  { name: 'avg', label: 'Average', fieldCount: 1 },
  { name: 'count', label: 'Count', fieldCount: 0 },
  { name: 'counta', label: 'Count Values', fieldCount: 1 },
  { name: 'countu', label: 'Count Unique', fieldCount: 1 },
  { name: 'min', label: 'Min', fieldCount: 1 },
  { name: 'max', label: 'Max', fieldCount: 1 },
  { name: 'list', label: 'Unique Values', fieldCount: 1 },
];