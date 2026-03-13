import { useEffect, useMemo, useState } from 'react';

import { DataGrid } from '../components/DataGrid';
import { DetailSlider } from '../components/DetailSlider';
import { TableRenderer } from '../components/table/TableRenderer';
import type { SelectionState, TableColumn } from '../components/table/types';
import type { ColumnFilterConfig, FilterSpec } from '../components/filters/types';
import { buildGroupSpec, getBuiltinGroupFunctions } from '../adapters/group-adapter';
import { normalizeComputedViewData, toLegacyAggregateSpec } from '../adapters/wcdatavis-interop';
import {
  SIMPLE_DATA,
  SIMPLE_COLUMNS,
  SIMPLE_FILTERS,
  WIDE_COLUMNS,
  WIDE_FILTERS,
  generateWideData,
  LEDGER_COLUMNS,
  LEDGER_FILTERS,
  generateLedgerData,
} from '../demo/data';
import { createMockView, DEMO_AGG_FUNCTIONS, demoTrans, type MockView } from '../demo/mock-grid';
import { LEGACY_MATRIX_COLUMNS, LEGACY_MATRIX_FILTERS, LEGACY_MATRIX_ROWS } from './legacyMatrixData';
import {
  AutoLimitScenario,
  CancelScenario,
  DrilldownScenario,
  GoogleChartScenario,
  NoAutoSaveScenario,
  OmnifilterScenario,
  PaginationScenario,
  PrefsScenario,
  RowCustomizationScenario,
  SourceParamsScenario,
} from './LegacyScenarioViews';

type HarnessAggregateSpec = Array<{ fn: string; fields: string[] }>;

function legacyIsoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));
}

function applyLegacyGroupFunction(value: string, fun: string) {
  const date = new Date(value);
  switch (fun) {
    case 'year':
      return String(date.getFullYear());
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'month':
      return date.toLocaleString('en-US', { month: 'long' });
    case 'week_iso':
      return `W${String(legacyIsoWeek(date)).padStart(2, '0')}`;
    case 'day_of_week':
      return date.toLocaleString('en-US', { weekday: 'long' });
    case 'year_and_quarter':
      return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'year_and_month':
      return `${date.getFullYear()} ${date.toLocaleString('en-US', { month: 'long' })}`;
    case 'year_and_week_iso':
      return `${date.getFullYear()} W${String(legacyIsoWeek(date)).padStart(2, '0')}`;
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'day_and_time_1hr': {
      const rounded = new Date(date);
      rounded.setMinutes(0, 0, 0);
      return `${date.toISOString().slice(0, 10)} ${rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    case 'day_and_time_15min': {
      const rounded = new Date(date);
      rounded.setMinutes(Math.floor(rounded.getMinutes() / 15) * 15, 0, 0);
      return `${date.toISOString().slice(0, 10)} ${rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    case 'time_1hr': {
      const rounded = new Date(date);
      rounded.setMinutes(0, 0, 0);
      return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    case 'time_15min': {
      const rounded = new Date(date);
      rounded.setMinutes(Math.floor(rounded.getMinutes() / 15) * 15, 0, 0);
      return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    default:
      return value;
  }
}

function translateLegacyAggregateName(fn: string) {
  if (fn === 'avg') return 'average';
  if (fn === 'countu') return 'countDistinct';
  if (fn === 'list') return 'distinctValues';
  return fn;
}

function serializeHarnessGroupKey(fields: Array<{ field: string }>, row: Record<string, unknown>) {
  return fields.map(({ field }) => `${field}:${String(row[field] ?? '')}`).join('|||');
}

function translateLegacyMatrixFilterSpec(spec: FilterSpec | null): FilterSpec | null {
  if (!spec) return null;

  const thisLastMap: Record<string, string> = {
    day: 'DATE',
    week: 'WEEK',
    month: 'MONTH',
    quarter: 'QUARTER',
    year: 'YEAR',
  };
  const everyDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const everyMonths = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  return Object.fromEntries(
    Object.entries(spec).map(([field, rawValue]) => {
      if (typeof rawValue !== 'object' || rawValue == null || Array.isArray(rawValue)) {
        return [field, rawValue];
      }

      const value = { ...(rawValue as Record<string, unknown>) };
      if (Array.isArray(value.$bet) && value.$bet.length === 2) {
        const [start, end] = value.$bet as unknown[];
        delete value.$bet;
        value.$gte = start;
        value.$lte = end;
      }
      if (typeof value.$this === 'string') {
        value.$this = thisLastMap[String(value.$this).toLowerCase()] ?? value.$this;
      }
      if (typeof value.$last === 'string') {
        value.$last = thisLastMap[String(value.$last).toLowerCase()] ?? value.$last;
      }
      if (typeof value.$every === 'object' && value.$every != null && !Array.isArray(value.$every)) {
        const every = value.$every as { unit?: unknown; value?: unknown };
        const unit = String(every.unit ?? '').toLowerCase();
        const rawOperand = Number(every.value);
        if (unit === 'day' && Number.isInteger(rawOperand) && rawOperand >= 0 && rawOperand < everyDays.length) {
          value.$every = everyDays[rawOperand];
        } else if (unit === 'month' && Number.isInteger(rawOperand) && rawOperand >= 0 && rawOperand < everyMonths.length) {
          value.$every = everyMonths[rawOperand];
        }
      }

      return [field, value];
    }),
  ) as FilterSpec;
}

function decodeHarnessValue(value: unknown, column: TableColumn | undefined): unknown {
  if (column?.typeInfo?.type === 'boolean' && typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  if ((column?.typeInfo?.type === 'currency' || column?.typeInfo?.type === 'number') && typeof value === 'object' && value != null) {
    const numberValue = Number(String((value as { toString?: () => string }).toString?.() ?? ''));
    if (!Number.isNaN(numberValue)) return numberValue;
  }

  return value;
}

function decodeHarnessRows(rows: Array<Record<string, unknown>>, columns: TableColumn[]) {
  const columnsByField = new Map(columns.map((column) => [column.field, column]));
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([field, value]) => [field, decodeHarnessValue(value, columnsByField.get(field))]),
    ),
  );
}

function computeLegacyAggregateValue(rows: Array<Record<string, unknown>>, spec: { fn: string; fields: string[] }) {
  const field = spec.fields[0];
  const values = field ? rows.map((row) => row[field]) : [];
  switch (spec.fn) {
    case 'count':
      return rows.length;
    case 'counta':
      return values.filter((value) => value != null && String(value) !== '').length;
    case 'countu':
      return new Set(values.filter((value) => value != null && String(value) !== '').map((value) => String(value))).size;
    case 'list': {
      const uniqueValues: string[] = [];
      for (const value of values) {
        const normalized = String(value ?? '');
        if (!normalized || uniqueValues.includes(normalized)) continue;
        uniqueValues.push(normalized);
      }
      return uniqueValues.join(', ');
    }
    case 'avg': {
      const numericValues = values.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
      return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    }
    case 'sum':
      return values.reduce((sum, value) => sum + Number(value), 0);
    case 'min':
      return Math.min(...values.map((value) => Number(value)));
    case 'max':
      return Math.max(...values.map((value) => Number(value)));
    default:
      return undefined;
  }
}

function buildLegacyMatrixGroupMetadata(
  rows: Array<Record<string, unknown>>,
  groupSpec: Array<{ field: string; fun?: string }>,
  aggregateSpec: HarnessAggregateSpec,
) {
  const metadata: Record<string, { groupValues: Record<string, unknown>; count: number; level: number; aggregates: Record<string, unknown> }> = {};

  for (const row of rows) {
    const groupValues = Object.fromEntries(
      groupSpec.map(({ field, fun }) => {
        const rawValue = String(row[field] ?? '');
        return [field, fun ? applyLegacyGroupFunction(rawValue, fun) : row[field]];
      }),
    );
    const key = serializeHarnessGroupKey(groupSpec, groupValues);
    metadata[key] ??= { groupValues, count: 0, level: 0, aggregates: {} };
    metadata[key].count += 1;
  }

  if (aggregateSpec.length > 0) {
    for (const [key, entry] of Object.entries(metadata)) {
      const groupRows = rows.filter((row) =>
        groupSpec.every(({ field, fun }) => {
          const rawValue = String(row[field] ?? '');
          const groupValue = fun ? applyLegacyGroupFunction(rawValue, fun) : row[field];
          return groupValue === entry.groupValues[field];
        }),
      );

      entry.aggregates = Object.fromEntries(
        aggregateSpec.map((spec) => {
          const aggField = spec.fields[0];
          const aggKey = aggField ? `${spec.fn}(${aggField})` : spec.fn;
          return [aggKey, computeLegacyAggregateValue(groupRows, spec)];
        }),
      );
      metadata[key] = entry;
    }
  }

  return metadata;
}

function mapLegacyPivotRecord(record: Record<string, unknown>, aggregateSpec: HarnessAggregateSpec) {
  if (aggregateSpec.length === 0) return record;
  return Object.fromEntries(
    aggregateSpec.map((spec) => {
      const sourceKey = spec.fields[0] ? `${spec.fn}(${spec.fields[0]})` : spec.fn;
      const translatedKey = spec.fields[0] ? `${translateLegacyAggregateName(spec.fn)}(${spec.fields[0]})` : translateLegacyAggregateName(spec.fn);
      return [spec.fn, record[sourceKey] ?? record[translatedKey]];
    }),
  );
}

type HarnessScenario =
  | 'default'
  | 'wide'
  | 'large'
  | 'allow-html'
  | 'format-strings'
  | 'operations'
  | 'multi-grid'
  | 'group-funs'
  | 'matrix'
  | 'auto-limit'
  | 'pagination'
  | 'omnifilter'
  | 'prefs'
  | 'no-auto-save'
  | 'source-params'
  | 'cancel'
  | 'google-chart'
  | 'drilldown'
  | 'row-customization';

interface HarnessConfig {
  id: string;
  title: string;
  data: Record<string, unknown>[];
  columns: TableColumn[];
  filters: ColumnFilterConfig[];
}

function getScenarioFromSearch(): HarnessScenario {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('e2e');
  if (
    scenario === 'wide'
    || scenario === 'large'
    || scenario === 'allow-html'
    || scenario === 'format-strings'
    || scenario === 'operations'
    || scenario === 'multi-grid'
    || scenario === 'group-funs'
    || scenario === 'matrix'
    || scenario === 'auto-limit'
    || scenario === 'pagination'
    || scenario === 'omnifilter'
    || scenario === 'prefs'
    || scenario === 'no-auto-save'
    || scenario === 'source-params'
    || scenario === 'cancel'
    || scenario === 'google-chart'
    || scenario === 'drilldown'
    || scenario === 'row-customization'
  ) {
    return scenario;
  }
  return 'default';
}

function getScenarioConfig(scenario: HarnessScenario): HarnessConfig {
  if (scenario === 'allow-html') {
    return {
      id: 'grid-allow-html',
      title: 'Allow HTML Harness Grid',
      data: [
        { name: 'Docs', link: '<a href="https://example.com/docs">Example Docs</a>' },
      ],
      columns: [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'link', header: 'Link', sortable: false, allowHtml: true },
      ],
      filters: [],
    };
  }
  if (scenario === 'format-strings') {
    return {
      id: 'grid-format-strings',
      title: 'Format Strings Harness Grid',
      data: [
        { status: '{{dv.fmt:bold fg=#b91c1c bg=#fef3c7}}Important{{/}}', plain: 'Unstyled' },
      ],
      columns: [
        { field: 'status', header: 'Status', sortable: false },
        { field: 'plain', header: 'Plain', sortable: false },
      ],
      filters: [],
    };
  }
  if (scenario === 'operations') {
    return {
      id: 'grid-operations',
      title: 'Operations Harness Grid',
      data: SIMPLE_DATA,
      columns: SIMPLE_COLUMNS,
      filters: SIMPLE_FILTERS,
    };
  }
  if (scenario === 'group-funs') {
    return {
      id: 'grid-group-funs',
      title: 'Group Functions Harness Grid',
      data: SIMPLE_DATA,
      columns: SIMPLE_COLUMNS,
      filters: SIMPLE_FILTERS,
    };
  }
  if (scenario === 'matrix') {
    return {
      id: 'grid-matrix',
      title: 'Legacy Matrix Harness Grid',
      data: LEGACY_MATRIX_ROWS,
      columns: LEGACY_MATRIX_COLUMNS,
      filters: LEGACY_MATRIX_FILTERS,
    };
  }
  if (scenario === 'wide') {
    return {
      id: 'grid-wide',
      title: 'Wide Harness Grid',
      data: generateWideData(20),
      columns: WIDE_COLUMNS,
      filters: WIDE_FILTERS,
    };
  }
  if (scenario === 'large') {
    const largeColumns = LEDGER_COLUMNS.slice(0, 6);
    const largeColumnFields = new Set(largeColumns.map((column) => column.field));
    return {
      id: 'grid-large',
      title: 'Large Harness Grid',
      data: generateLedgerData(5000),
      columns: largeColumns,
      filters: LEDGER_FILTERS.filter((filter) => largeColumnFields.has(filter.field)),
    };
  }
  return {
    id: 'grid-default',
    title: 'Default Harness Grid',
    data: SIMPLE_DATA,
    columns: SIMPLE_COLUMNS,
    filters: SIMPLE_FILTERS,
  };
}

interface WindowWithHarness extends Window {
  __wcdv?: {
    getState: () => {
      scenario: HarnessScenario;
      mode: 'plain' | 'group' | 'pivot';
      rowCount: number;
      selectedRows: number[];
      visibleRows: Record<string, unknown>[];
      filterSpec: FilterSpec | null;
      groupFields: string[];
      pivotFields: string[];
      groupMetadata: Record<string, unknown>;
      rowVals: Record<string, unknown>[];
      colVals: unknown[];
      pivotMatrix: Array<Array<Record<string, unknown>>>;
      pivotGrandTotal: Record<string, unknown>;
      sort: { field?: string; dir?: string } | null;
      totalAggregates: Record<string, unknown>;
      busy: boolean;
      revision: number;
    };
    actions: {
      setFilter: (spec: FilterSpec | null) => void;
      clearFilter: () => void;
      setSort: (field: string, dir: 'ASC' | 'DESC') => void;
      clearSort: () => void;
      setGroup: (fields: string[]) => void;
      setGroupSpec: (fields: Array<{ field: string; fun?: string }>) => void;
      setPivot: (fields: string[]) => void;
      setPivotSpec: (fields: Array<{ field: string; fun?: string }>) => void;
      clearGroup: () => void;
      setAggregate: (spec: Array<{ fn: string; fields: string[] }> | null) => void;
      refresh: () => void;
    };
  };
}

function parseFormatString(value: string) {
  const match = value.match(/^\{\{dv\.fmt:([^}]+)\}\}(.+)\{\{\/\}\}$/);
  if (!match) return null;
  const attrs = match[1].split(/\s+/);
  const style: Record<string, string> = {};
  let fontWeight: string | undefined;

  for (const attr of attrs) {
    if (attr === 'bold') fontWeight = '700';
    if (attr.startsWith('fg=')) style.color = attr.slice(3);
    if (attr.startsWith('bg=')) style.backgroundColor = attr.slice(3);
  }

  return {
    text: match[2],
    style,
    fontWeight,
  };
}

function renderScenarioCell(scenario: HarnessScenario, value: unknown, column: TableColumn) {
  if (scenario === 'allow-html' && column.allowHtml && typeof value === 'string') {
    const linkMatch = value.match(/<a href="([^"]+)">([^<]+)<\/a>/i);
    if (linkMatch) {
      return <a href={linkMatch[1]} target="_blank" rel="noreferrer">{linkMatch[2]}</a>;
    }
  }

  if (scenario === 'format-strings' && typeof value === 'string') {
    const parsed = parseFormatString(value);
    if (parsed) {
      return (
        <span style={{ ...parsed.style, fontWeight: parsed.fontWeight }} className="wcdv-format-string">
          {parsed.text}
        </span>
      );
    }
  }

  return undefined;
}

function HarnessGrid({
  config,
  scenario,
  registerApi = true,
}: {
  config: HarnessConfig;
  scenario: HarnessScenario;
  registerApi?: boolean;
}) {
  const view = useMemo(() => createMockView(config.data, config.columns), [config.columns, config.data]);
  const [viewData, setViewData] = useState(() => ({ isPlain: true, isGroup: false, isPivot: false, data: config.data }));
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(1);
  const [filterSpec, setFilterSpec] = useState<FilterSpec | null>(null);
  const [groupSpec, setGroupSpec] = useState<Array<{ field: string; fun?: string }>>([]);
  const [aggregateSpec, setAggregateSpec] = useState<HarnessAggregateSpec>([]);
  const [selection, setSelection] = useState<SelectionState>({
    selectedRows: new Set(),
    activeRow: null,
    activeColumn: null,
  });
  const tableDef = useMemo(
    () => ({ groupMode: 'detail' as const, whenGroup: { showTotalRow: true, showExpandedGroups: true, pinRowvals: false } }),
    [],
  );
  const groupFnDefs = useMemo(() => getBuiltinGroupFunctions(demoTrans), []);
  const [operationLog, setOperationLog] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null);
  const controlFields = useMemo(
    () => config.columns.map((column) => ({ field: column.field, displayName: column.header ?? column.field, type: column.typeInfo?.type })),
    [config.columns],
  );
  const aggregateFields = useMemo(
    () => config.columns.map((column) => ({ field: column.field, displayName: column.header ?? column.field })),
    [config.columns],
  );
  const preserveChildViewData = scenario === 'allow-html' || scenario === 'format-strings';

  useEffect(() => {
    const handleWorkBegin = () => {
      setBusy(true);
    };
    const handleWorkEnd = () => {
      const currentViewData = normalizeComputedViewData(
        (view as MockView & { data: unknown }).data,
        (view as { typeInfo?: unknown }).typeInfo,
        view.getAggregate?.() ?? null,
      );
      if (currentViewData) setViewData(currentViewData);
      setBusy(false);
      setRevision((value) => value + 1);
    };
    view.on('workBegin', handleWorkBegin, { who: 'E2EHarness-begin' });
    view.on('workEnd', handleWorkEnd, { who: 'E2EHarness-end' });
    view.getData();
    return () => {
      view.off('workBegin', 'E2EHarness-begin');
      view.off('workEnd', 'E2EHarness-end');
    };
  }, [view]);

  useEffect(() => {
    if (!registerApi) return undefined;

    const win = window as WindowWithHarness;
    win.__wcdv = {
      getState: () => {
        const decodedVisibleRows = Array.isArray(viewData.data)
          ? decodeHarnessRows(viewData.data as Record<string, unknown>[], config.columns)
          : [];
        const mode = viewData.isPivot ? 'pivot' : viewData.isGroup ? 'group' : 'plain';
        const synthesizedGroupMetadata = scenario === 'matrix' && mode === 'group' && groupSpec.length > 0
          ? buildLegacyMatrixGroupMetadata(
              groupSpec.some((entry) => entry.fun)
                ? decodeHarnessRows(config.data, config.columns)
                : decodedVisibleRows,
              groupSpec,
              aggregateSpec,
            )
          : (viewData.groupMetadata ?? {});

        return {
          scenario,
          mode,
          rowCount: decodedVisibleRows.length,
          selectedRows: [...selection.selectedRows.values()],
          visibleRows: decodedVisibleRows,
          filterSpec,
          groupFields: viewData.isGroup ? [...(viewData.groupFields ?? [])] : [],
          pivotFields: viewData.isPivot ? [...(viewData.pivotFields ?? [])] : [],
          groupMetadata: synthesizedGroupMetadata,
          rowVals: viewData.isPivot ? ((viewData.rowVals ?? []) as Record<string, unknown>[]) : [],
          colVals: viewData.isPivot ? (viewData.colVals ?? []) : [],
          pivotMatrix: viewData.isPivot
            ? ((viewData.data ?? []) as Array<Array<Record<string, unknown>>>).map((row) => row.map((cell) => mapLegacyPivotRecord(cell, aggregateSpec)))
            : [],
          pivotGrandTotal: viewData.isPivot ? mapLegacyPivotRecord((viewData.grandTotal ?? {}) as Record<string, unknown>, aggregateSpec) : {},
          totalAggregates: viewData.totalAggregates ?? {},
          sort: view.getSort() as { field?: string; dir?: string } | null,
          busy,
          revision,
        };
      },
      actions: {
        setFilter: (spec) => {
          setFilterSpec(spec);
          const translatedSpec = scenario === 'matrix' ? translateLegacyMatrixFilterSpec(spec) : spec;
          if (!translatedSpec || Object.keys(translatedSpec).length === 0) view.clearFilter();
          else view.setFilter(translatedSpec);
        },
        clearFilter: () => {
          setFilterSpec(null);
          view.clearFilter();
        },
        setSort: (field, dir) => view.setSort({ vertical: { field, dir } }),
        clearSort: () => view.clearSort(),
        setGroup: (fields) => {
          setGroupSpec(fields.map((field) => ({ field })));
          if (fields.length === 0) view.clearGroup();
          else view.setGroup({ fieldNames: fields.map((field) => ({ field })) });
        },
        setGroupSpec: (fields) => {
          setGroupSpec(fields);
          if (fields.length === 0) view.clearGroup();
          else view.setGroup(buildGroupSpec(fields));
        },
        setPivot: (fields) => {
          if (fields.length === 0) view.clearPivot();
          else view.setPivot(buildGroupSpec(fields.map((field) => ({ field }))));
        },
        setPivotSpec: (fields) => {
          if (fields.length === 0) view.clearPivot();
          else view.setPivot(buildGroupSpec(fields));
        },
        clearGroup: () => {
          setGroupSpec([]);
          view.clearGroup();
        },
        setAggregate: (spec) => {
          setAggregateSpec(spec ?? []);
          const translatedSpec = spec?.map((entry) => ({ ...entry, fn: translateLegacyAggregateName(entry.fn) })) ?? null;
          view.setAggregate(toLegacyAggregateSpec(translatedSpec));
        },
        refresh: () => view.refresh(),
      },
    };
    return () => {
      delete win.__wcdv;
    };
  }, [aggregateSpec, busy, config.columns, config.data, filterSpec, groupSpec, registerApi, revision, scenario, selection, view, viewData]);

  const operations = useMemo(
    () => scenario === 'operations'
      ? [
          {
            label: 'Delete',
            icon: '🗑',
            category: 'Power',
            callback: () => setOperationLog((current) => [...current, 'Delete']),
          },
          {
            label: 'Favorite',
            icon: '★',
            category: 'Rating',
            callback: () => setOperationLog((current) => [...current, 'Favorite']),
          },
        ]
      : [],
    [scenario],
  );

  const formatCell = useMemo(
    () => (
      scenario === 'allow-html' || scenario === 'format-strings'
        ? (value: unknown, _row: Record<string, unknown>, column: TableColumn) => renderScenarioCell(scenario, value, column) ?? value?.toString?.() ?? ''
        : undefined
    ),
    [scenario],
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <DataGrid
        view={view}
        tableDef={tableDef}
        title={config.title}
        helpText={`E2E harness scenario: ${scenario}`}
        showToolbar={true}
        showControls={true}
        debug={true}
        preserveChildViewData={preserveChildViewData}
        filterColumns={config.filters}
        allColumns={config.columns}
        controlFields={controlFields}
        aggregateFields={aggregateFields}
        aggregateFunctions={DEMO_AGG_FUNCTIONS}
        groupFunctionDefs={groupFnDefs}
        operations={operations}
      >
        <TableRenderer
          viewData={viewData}
          columns={config.columns}
          totalRows={config.data.length}
          groupMode={tableDef.groupMode}
          showTotalRow={tableDef.whenGroup.showTotalRow}
          groupsExpanded={tableDef.whenGroup.showExpandedGroups}
          aggFnLabels={Object.fromEntries(DEMO_AGG_FUNCTIONS.map((fn) => [fn.name, fn.label]))}
          features={{
            columnResize: true,
            columnReorder: true,
            stickyHeaders: true,
            zebraStripe: true,
            keyboardNav: true,
            headerContextMenu: true,
            rowSelection: true,
          }}
          formatCell={formatCell}
          onSelectionChange={setSelection}
          onRowClick={(row) => setDetailRow(row.data)}
        />
      </DataGrid>
      <DetailSlider
        open={detailRow != null}
        header={detailRow ? `Detail panel` : ''}
        onClose={() => setDetailRow(null)}
      >
        <pre className="text-xs text-slate-700 whitespace-pre-wrap">{detailRow ? JSON.stringify(detailRow, null, 2) : ''}</pre>
      </DetailSlider>
      {operationLog.length > 0 && (
        <div data-testid="operation-log" className="mt-4 text-sm text-slate-700">
          {operationLog.join(', ')}
        </div>
      )}
    </div>
  );
}

export function E2EHarnessApp() {
  const scenario = getScenarioFromSearch();
  const config = useMemo(() => getScenarioConfig(scenario), [scenario]);

  if (scenario === 'auto-limit') return <AutoLimitScenario />;
  if (scenario === 'pagination') return <PaginationScenario />;
  if (scenario === 'omnifilter') return <OmnifilterScenario />;
  if (scenario === 'prefs') return <PrefsScenario />;
  if (scenario === 'no-auto-save') return <NoAutoSaveScenario />;
  if (scenario === 'source-params') return <SourceParamsScenario />;
  if (scenario === 'cancel') return <CancelScenario />;
  if (scenario === 'google-chart') return <GoogleChartScenario />;
  if (scenario === 'drilldown') return <DrilldownScenario />;
  if (scenario === 'row-customization') return <RowCustomizationScenario />;

  if (scenario === 'multi-grid') {
    return (
      <div className="min-h-screen bg-slate-100 p-6 grid grid-cols-1 gap-6">
        <HarnessGrid config={getScenarioConfig('default')} scenario="default" registerApi={false} />
        <HarnessGrid config={getScenarioConfig('wide')} scenario="wide" registerApi={false} />
      </div>
    );
  }

  return <HarnessGrid config={config} scenario={scenario} />;
}

export function isE2EMode() {
  return new URLSearchParams(window.location.search).has('e2e');
}