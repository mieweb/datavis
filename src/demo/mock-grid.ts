import type { ViewInstance, ViewData, SourceInstance } from '../adapters/use-data';
import type { AggregateFunction } from '../components/controls/AggregateSection';
import type { FilterSpec } from '../components/filters/types';
import { applyFilter } from './apply-filter';
import enUsTsv from '../i18n/en-US.tsv?raw';

export interface GroupSpec {
  fieldNames: { field: string; fun?: string }[];
}

export interface AggSpec {
  fn: string;
  fields: string[];
}

export interface MockView extends ViewInstance {
  _filterSpec: FilterSpec | null;
  filterSpec: FilterSpec | null;
  _sortSpec: { vertical?: { field: string; dir: string } } | null;
  _groupSpec: GroupSpec | null;
  _aggSpec: AggSpec[] | null;
}

function getIsoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));
}

function formatQuarter(date: Date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function formatMonth(date: Date) {
  return date.toLocaleString('en-US', { month: 'long' });
}

function formatDayOfWeek(date: Date) {
  return date.toLocaleString('en-US', { weekday: 'long' });
}

function formatTimeSlice(date: Date, minutes: number) {
  const rounded = new Date(date);
  rounded.setMinutes(Math.floor(date.getMinutes() / minutes) * minutes, 0, 0);
  return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function applyGroupFunction(value: unknown, fun?: string): unknown {
  if (!fun) return value;
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return value;

  switch (fun) {
    case 'year':
      return String(date.getFullYear());
    case 'quarter':
      return formatQuarter(date);
    case 'month':
      return formatMonth(date);
    case 'week_iso':
      return `W${String(getIsoWeek(date)).padStart(2, '0')}`;
    case 'day_of_week':
      return formatDayOfWeek(date);
    case 'year_and_quarter':
      return `${date.getFullYear()} ${formatQuarter(date)}`;
    case 'year_and_month':
      return `${date.getFullYear()} ${formatMonth(date)}`;
    case 'year_and_week_iso':
      return `${date.getFullYear()} W${String(getIsoWeek(date)).padStart(2, '0')}`;
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'day_and_time_1hr':
      return `${date.toISOString().slice(0, 10)} ${formatTimeSlice(date, 60)}`;
    case 'day_and_time_15min':
      return `${date.toISOString().slice(0, 10)} ${formatTimeSlice(date, 15)}`;
    case 'time_1hr':
      return formatTimeSlice(date, 60);
    case 'time_15min':
      return formatTimeSlice(date, 15);
    default:
      return value;
  }
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

function computeAggregateValue(rows: Record<string, unknown>[], agg: AggSpec): unknown {
  const field = agg.fields[0];
  if (agg.fn === 'count') return rows.length;
  if (!field) return null;

  if (agg.fn === 'counta') {
    return rows.filter((row) => row[field] != null && row[field] !== '').length;
  }
  if (agg.fn === 'countu') {
    return new Set(rows.map((row) => row[field]).filter((value) => value != null && value !== '')).size;
  }
  if (agg.fn === 'list') {
    const uniq = [...new Set(rows.map((row) => row[field]).filter((value) => value != null && value !== '').map(String))];
    return uniq.join(', ');
  }

  const numbers = rows.map((row) => Number(row[field])).filter((value) => !Number.isNaN(value));
  if (agg.fn === 'sum') return numbers.reduce((sum, value) => sum + value, 0);
  if (agg.fn === 'avg') return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
  if (agg.fn === 'min') return numbers.length ? Math.min(...numbers) : null;
  if (agg.fn === 'max') return numbers.length ? Math.max(...numbers) : null;
  return null;
}

function computeAggregateMap(rows: Record<string, unknown>[], aggSpecs: AggSpec[]): Record<string, unknown> {
  const aggregates: Record<string, unknown> = {};
  for (const agg of aggSpecs) {
    const field = agg.fields[0];
    const label = field ? `${agg.fn}(${field})` : agg.fn;
    aggregates[label] = computeAggregateValue(rows, agg);
  }
  return aggregates;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  const aString = String(a);
  const bString = String(b);

  const aDate = Date.parse(aString);
  const bDate = Date.parse(bString);
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) return aDate - bDate;

  const aNumber = Number(aString.replaceAll(',', ''));
  const bNumber = Number(bString.replaceAll(',', ''));
  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber;

  return aString.localeCompare(bString);
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
    _sortSpec: null as { vertical?: { field: string; dir: string } } | null,
    _groupSpec: null as GroupSpec | null,
    _aggSpec: null as AggSpec[] | null,
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
          const result = view._filterSpec ? applyFilter(data, view._filterSpec) : [...data];

          if (view._sortSpec?.vertical) {
            const { field, dir } = view._sortSpec.vertical;
            const direction = dir === 'DESC' ? -1 : 1;
            result.sort((left, right) => compareValues(left[field], right[field]) * direction);
          }

          const groupFields = (view._groupSpec?.fieldNames ?? []).map((fieldInfo) => fieldInfo.field);
          const groupFieldSpecs = view._groupSpec?.fieldNames ?? [];
          const isGroup = groupFields.length > 0;
          let groupMetadata: Record<string, unknown> | undefined;

          if (isGroup) {
            const buckets = new Map<string, Record<string, unknown>[]>();
            for (const row of result) {
              const key = groupFieldSpecs
                .map((fieldInfo) => String(applyGroupFunction(row[fieldInfo.field], fieldInfo.fun) ?? ''))
                .join('|||');
              if (!buckets.has(key)) buckets.set(key, []);
              buckets.get(key)?.push(row);
            }

            groupMetadata = {};
            for (const [key, rows] of buckets) {
              groupMetadata[key] = {
                groupValues: Object.fromEntries(groupFieldSpecs.map((fieldInfo) => [fieldInfo.field, applyGroupFunction(rows[0]?.[fieldInfo.field], fieldInfo.fun)])),
                count: rows.length,
                level: 0,
                aggregates: view._aggSpec?.length ? computeAggregateMap(rows, view._aggSpec) : {},
              };
            }
          }

          const totalAggregates = view._aggSpec?.length ? computeAggregateMap(result, view._aggSpec) : undefined;

          view.data = {
            isPlain: !isGroup,
            isGroup,
            isPivot: false,
            data: result,
            ...(isGroup ? { groupFields } : {}),
            ...(groupMetadata ? { groupMetadata } : {}),
            ...(totalAggregates ? { totalAggregates } : {}),
          } as ViewData;

          view.fire('workEnd', {
            isPlain: !isGroup,
            isGroup,
            isPivot: false,
            numRows: result.length,
            totalRows: rowCount,
            numGroups: isGroup
              ? new Set(result.map((row) => groupFieldSpecs.map((fieldInfo) => applyGroupFunction(row[fieldInfo.field], fieldInfo.fun)).join('|||'))).size
              : 0,
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