import { useEffect, useMemo, useState } from 'react';

import { DataGrid } from '../components/DataGrid';
import { DetailSlider } from '../components/DetailSlider';
import { TableRenderer } from '../components/table/TableRenderer';
import type { SelectionState, TableColumn } from '../components/table/types';
import type { ColumnFilterConfig, FilterSpec } from '../components/filters/types';
import { buildGroupSpec, getBuiltinGroupFunctions } from '../adapters/group-adapter';
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
    return {
      id: 'grid-large',
      title: 'Large Harness Grid',
      data: generateLedgerData(5000),
      columns: LEDGER_COLUMNS,
      filters: LEDGER_FILTERS,
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
      rowCount: number;
      selectedRows: number[];
      visibleRows: Record<string, unknown>[];
      filterSpec: FilterSpec | null;
      groupFields: string[];
      sort: { field?: string; dir?: string } | null;
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
  const view = useMemo(() => createMockView(config.data, config.data.length), [config.data]);
  const [viewData, setViewData] = useState(() => ({ isPlain: true, isGroup: false, isPivot: false, data: config.data }));
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
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

  useEffect(() => {
    const handleWorkBegin = () => {
      setBusy(true);
    };
    const handleWorkEnd = () => {
      const currentViewData = (view as MockView & { data: typeof viewData | null }).data;
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
      getState: () => ({
        scenario,
        mode: viewData.isPivot ? 'pivot' : viewData.isGroup ? 'group' : 'plain',
        rowCount: Array.isArray(viewData.data) ? viewData.data.length : 0,
        selectedRows: [...selection.selectedRows.values()],
        visibleRows: Array.isArray(viewData.data) ? viewData.data as Record<string, unknown>[] : [],
        filterSpec: view.filterSpec,
        groupFields: viewData.isGroup ? [...(viewData.groupFields ?? [])] : [],
        groupMetadata: viewData.isGroup ? (viewData.groupMetadata ?? {}) : {},
        totalAggregates: viewData.totalAggregates ?? {},
        sort: view.getSort() as { field?: string; dir?: string } | null,
        busy,
        revision,
      }),
      actions: {
        setFilter: (spec) => {
          if (!spec || Object.keys(spec).length === 0) view.clearFilter();
          else view.setFilter(spec);
        },
        clearFilter: () => view.clearFilter(),
        setSort: (field, dir) => view.setSort({ vertical: { field, dir } }),
        clearSort: () => view.clearSort(),
        setGroup: (fields) => {
          if (fields.length === 0) view.clearGroup();
          else view.setGroup({ fieldNames: fields.map((field) => ({ field })) });
        },
        setGroupSpec: (fields) => {
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
        clearGroup: () => view.clearGroup(),
        setAggregate: (spec) => view.setAggregate(spec),
        refresh: () => view.refresh(),
      },
    };
    return () => {
      delete win.__wcdv;
    };
  }, [busy, registerApi, revision, scenario, selection, view, viewData]);

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
        trans={demoTrans}
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
          trans={demoTrans}
          formatCell={formatCell}
          onSelectionChange={setSelection}
          onRowClick={(row) => setDetailRow(row.data)}
        />
      </DataGrid>
      <DetailSlider
        open={detailRow != null}
        header={detailRow ? `Detail panel` : ''}
        onClose={() => setDetailRow(null)}
        trans={demoTrans}
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