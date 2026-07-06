/**
 * DataGrid — Top-level React component replacing the jQuery Grid class.
 *
 * Composes: TitleBar, Toolbar, ControlPanel placeholder, OperationsPalette,
 * loading overlay, and content area.
 */

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';

import { useDataVisEvent } from '../adapters/event-bridge';
import { useView, useSource, type ViewData, type ViewInstance } from '../adapters/use-data';
import { usePrefs, type PrefsInstance } from '../adapters/use-prefs';
import {
  buildGroupSpec,
  getGroupFunctionLabel,
  filterGroupFunctionsForType,
  needsGroupFunction,
} from '../adapters/group-adapter';
import { toLegacyAggregateSpec } from '../adapters/wcdatavis-interop';
import { useTranslation } from 'react-i18next';
import { LocaleProvider } from '../i18n';
import { COLUMN_DRAG_MIME } from './controls/column-drag';
import { TitleBar } from './TitleBar';
import { MinimalMenu } from './MinimalMenu';
import { rowsToCsv, downloadCsv, copyToClipboard, buildCsvFilename } from './export-utils';
import { GridToolbar } from './GridToolbar';
import { ControlPanel } from './controls/ControlPanel';
import { type ControlFieldItem } from './controls/ControlSection';
import { type AggregateEntry, type AggregateFunction } from './controls/AggregateSection';
import { type ColumnFilterConfig, type FieldFilterSpec, type FilterSpec } from './filters/types';
import { FilterContext, columnToFilterConfig, type FilterContextValue } from './filters/FilterContext';
import { getStableRowId } from './table/row-identity';
import type { TableColumn, MultiSortSpec, SortDirection, SelectionState } from './table/types';
import { SortContext, type SortContextValue } from './table/SortContext';
import { ColumnConfigContext, type ColumnConfigContextValue } from './table/ColumnConfigContext';
import { ColumnDropProvider, type ColumnDropContextValue } from './table/ColumnDropContext';
import { OperationsPalette, type Operation } from './OperationsPalette';
import { DetailSlider } from './DetailSlider';
import { LoadingOverlay } from './LoadingOverlay';
import { ColumnConfigDialog, type ColumnConfig } from './dialogs/ColumnConfigDialog';
import type { TemplateData } from './dialogs/TemplateEditorDialog';
import { GridTableOptionsDialog, type DisplayFormatConfig } from './dialogs/GridTableOptionsDialog';
import { GroupFunctionDialog } from './dialogs/GroupFunctionDialog';
import type { GroupFunction as GroupFunctionDef } from './dialogs/GroupFunctionDialog';
import { PerspectiveManagerDialog } from './dialogs/PerspectiveManagerDialog';
import type { TableRendererProps } from './table/TableRenderer';

const DEFAULT_ROW_BATCH_SIZE = 100;

function limitPlainViewData(viewData: ViewData | null, visibleRowCount: number): ViewData | null {
  if (!viewData?.isPlain || !Array.isArray(viewData.data)) {
    return viewData;
  }

  const limitedData = viewData.data.slice(0, visibleRowCount);
  if (limitedData.length === viewData.data.length) {
    return viewData;
  }

  const limitedRowIds = new Set(
    limitedData
      .map((row) => (row as Record<string, unknown>)?._rowId)
      .filter((rowId): rowId is string => typeof rowId === 'string'),
  );

  const limitedDataByRowId = viewData.dataByRowId
    ? Object.fromEntries(
        Object.entries(viewData.dataByRowId).filter(([rowId]) => limitedRowIds.has(rowId)),
      )
    : undefined;

  return {
    ...viewData,
    data: limitedData,
    ...(limitedDataByRowId ? { dataByRowId: limitedDataByRowId } : {}),
  };
}

interface LegacyGroupFieldSpec {
  field?: unknown;
  fun?: unknown;
}

interface LegacyGroupSpec {
  fieldNames?: LegacyGroupFieldSpec[];
}

interface LegacyAggregateItem {
  fn?: unknown;
  fun?: unknown;
  fields?: unknown;
}

interface LegacyAggregateSpec {
  group?: LegacyAggregateItem[];
  pivot?: LegacyAggregateItem[];
  cell?: LegacyAggregateItem[];
  all?: LegacyAggregateItem[];
}

function parseGroupSpec(spec: unknown): Array<{ field: string; fun?: string }> {
  if (!spec || typeof spec !== 'object') {
    return [];
  }

  const fieldNames = (spec as LegacyGroupSpec).fieldNames;
  if (!Array.isArray(fieldNames)) {
    return [];
  }

  return fieldNames.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || typeof entry.field !== 'string') {
      return [];
    }

    const parsed: { field: string; fun?: string } = { field: entry.field };
    if (typeof entry.fun === 'string' && entry.fun.length > 0) {
      parsed.fun = entry.fun;
    }
    return [parsed];
  });
}

function parseAggregateEntries(spec: unknown): AggregateEntry[] {
  if (!spec || typeof spec !== 'object') {
    return [];
  }

  const aggregateSpec = spec as LegacyAggregateSpec;
  const channel = [aggregateSpec.group, aggregateSpec.pivot, aggregateSpec.cell, aggregateSpec.all]
    .find((entries) => Array.isArray(entries) && entries.length > 0);

  if (!Array.isArray(channel)) {
    return [];
  }

  return channel.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const fn = typeof entry.fn === 'string'
      ? entry.fn
      : typeof entry.fun === 'string'
        ? entry.fun
        : null;

    if (!fn) {
      return [];
    }

    const fields = Array.isArray(entry.fields)
      ? entry.fields.filter((field): field is string => typeof field === 'string')
      : [];

    return [{
      id: `agg-loaded-${index}-${fn}`,
      functionName: fn,
      fields,
      visible: true,
    } satisfies AggregateEntry];
  });
}

function parseFilterSpec(spec: unknown): FilterSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {};
  }

  const result: FilterSpec = {};
  for (const [field, value] of Object.entries(spec as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[field] = value as FilterSpec[string];
    }
  }

  return result;
}

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

/** Grid table definition — mirrors Grid~Defn.table */
export interface GridTableDef {
  id?: string;
  columns?: unknown[];
  features?: Record<string, boolean>;
  limit?: { autoShowMore?: boolean; limit?: number };
  rowMode?: 'wrapped' | 'clipped';
  groupMode?: 'summary' | 'detail';
  whenGroup?: {
    showTotalRow?: boolean;
    showExpandedGroups?: boolean;
    pinRowvals?: boolean;
  };
  whenPivot?: {
    showTotalCol?: boolean;
    hideBottomValueAggResults?: boolean;
  };
  [key: string]: unknown;
}

/** Grid header display mode. See `DataGridProps.mode`. */
export type GridMode = 'default' | 'full' | 'minimal';

export interface DataGridProps {
  /** ComputedView instance from wcdatavis core */
  view: ViewInstance;
  /** Optional Prefs instance for perspective management */
  prefs?: PrefsInstance;
  /** Grid table definition */
  tableDef?: GridTableDef;
  /** Grid title */
  title?: string;
  /** Help text shown as tooltip */
  helpText?: string;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to show controls (filter/group/pivot/aggregate) initially */
  showControls?: boolean;
  /**
   * Display mode for the grid header:
   * - `'default'` (new default): title bar with a smaller title, no seeded count
   *   footer, and the minimal-mode hamburger menu replacing the inline
   *   perspective/refresh/gear buttons.
   * - `'full'`: the classic title bar with row count and inline perspective and
   *   action buttons.
   * - `'minimal'`: no title bar — a floating hamburger menu overlays the table.
   */
  mode?: GridMode;
  /**
   * @deprecated Use `mode="minimal"` instead. Kept for backward compatibility;
   * when `true` it forces `mode="minimal"`.
   */
  minimalMode?: boolean;
  /** Grid height (CSS value) */
  height?: string;
  /** Operations for the operations palette */
  operations?: Operation[];
  /** Callback when grid visibility is toggled */
  onToggle?: (visible: boolean) => void;
  /** Custom className */
  className?: string;
  /** Children rendered in the content area (e.g. table renderer) */
  children?: React.ReactNode;
  /** BCP-47 locale for number/date formatting (e.g. 'en-US'). Defaults to browser locale. */
  locale?: string;
  /** Enable debug button */
  debug?: boolean;
  /** Preserve a child renderer's explicitly supplied viewData prop instead of replacing it with useView output. */
  preserveChildViewData?: boolean;
  /** Column filter configurations for the filter bar */
  filterColumns?: ColumnFilterConfig[];
  /** All table columns — used to derive filter configs when filter icon is clicked */
  allColumns?: TableColumn[];
  /** Available fields for group/pivot controls */
  controlFields?: { field: string; displayName: string; disabled?: boolean; type?: string }[];
  /** Available fields for aggregate controls */
  aggregateFields?: { field: string; displayName: string }[];
  /** Available aggregate functions */
  aggregateFunctions?: AggregateFunction[];
  /** Column configs for the Column Configuration dialog */
  columnConfigs?: ColumnConfig[];
  /** Callback when column configuration is saved */
  onColumnConfigSave?: (columns: ColumnConfig[], clearRenderCache: string[]) => void;
  /** Template data for the Template Editor dialog */
  templates?: TemplateData;
  /** Callback when templates are saved */
  onTemplateSave?: (templates: TemplateData) => void;
  /** Display format config for the Grid Table Options dialog */
  displayFormat?: DisplayFormatConfig;
  /** Callback when display format is saved */
  onDisplayFormatSave?: (displayFormat: DisplayFormatConfig) => void;
  /** Group function definitions for the Group Function dialog */
  groupFunctionDefs?: GroupFunctionDef[];
  /** Callback when a group function is selected */
  onGroupFunctionSelect?: (fieldName: string, functionName: string | null) => void;
}

interface PerspectiveDialogHostProps {
  prefs: PrefsInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PerspectiveDialogHost({ prefs, open, onOpenChange }: PerspectiveDialogHostProps) {
  const {
    perspectives,
    currentPerspectiveId,
    selectPerspective,
    addPerspective,
    renamePerspective,
    deletePerspective,
  } = usePrefs(prefs);

  const currentPerspective = useMemo(
    () => perspectives.find((p) => p.id === currentPerspectiveId),
    [perspectives, currentPerspectiveId],
  );

  return (
    <PerspectiveManagerDialog
      open={open}
      onOpenChange={onOpenChange}
      currentPerspective={currentPerspective}
      perspectives={perspectives}
      onSwitch={selectPerspective}
      onCreate={addPerspective}
      onRename={renamePerspective}
      onDelete={deletePerspective}
    />
  );
}

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function DataGrid({
  view,
  prefs,
  tableDef,
  title = '',
  helpText,
  showToolbar = true,
  showControls: initialShowControls = false,
  mode = 'default',
  minimalMode = false,
  height,
  operations = [],
  onToggle,
  className = '',
  children,
  locale,
  debug: _debug = false,
  preserveChildViewData = false,
  filterColumns = [],
  allColumns = [],
  controlFields = [],
  aggregateFields = [],
  aggregateFunctions = [],
  columnConfigs: columnConfigsProp = [],
  onColumnConfigSave,
  templates: _templates = {},
  onTemplateSave: _onTemplateSave,
  displayFormat,
  onDisplayFormatSave,
  groupFunctionDefs = [],
  onGroupFunctionSelect,
}: DataGridProps) {
  // ── i18n via react-i18next ─
  const { t } = useTranslation();
  // `minimalMode` is a deprecated alias for `mode="minimal"`.
  const gridMode: GridMode = minimalMode ? 'minimal' : mode;
  const [internalTableDef] = useState<GridTableDef>(() => ({
    rowMode: 'wrapped',
    limit: { autoShowMore: true, limit: DEFAULT_ROW_BATCH_SIZE },
    groupMode: 'detail',
    whenGroup: { showTotalRow: true, showExpandedGroups: true, pinRowvals: false },
    whenPivot: { showTotalCol: true, hideBottomValueAggResults: false },
  }));
  const effectiveTableDef = tableDef ?? internalTableDef;

  // ── Adapter hooks ──────────────────────────────
  const viewState = useView(view);
  const sourceState = useSource(view.source);

  // ── Local UI state ─────────────────────────────
  // Default mode is the compact/clean view: controls start hidden regardless
  // of the `showControls` prop (the user opens them from the hamburger menu).
  const controlsInitiallyVisible = gridMode === 'default' ? false : initialShowControls;
  const [collapsed, setCollapsed] = useState(false);
  const controlsVisibleRef = useRef(controlsInitiallyVisible);
  /** Mirrors controlsVisibleRef so the title bar can embed actions inline while open */
  const [controlsOpen, setControlsOpen] = useState(controlsInitiallyVisible);
  const controlsWrapperRef = useRef<HTMLDivElement>(null);
  const gridTableRef = useRef<HTMLDivElement>(null);
  const setControlsVisible = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(controlsVisibleRef.current) : value;
    if (next === controlsVisibleRef.current) return;
    controlsVisibleRef.current = next;
    controlsWrapperRef.current?.classList.toggle('hidden', !next);
    setControlsOpen(next);
  }, []);

  // ── Dynamic filter columns ─────────────────────
  const [dynamicFilterColumns, setDynamicFilterColumns] = useState<ColumnFilterConfig[]>([]);
  const [initialFilterSpec, setInitialFilterSpec] = useState<FilterSpec>({});
  /** Latest combined filter spec (drives header filter dropdowns) */
  const [currentFilterSpec, setCurrentFilterSpec] = useState<FilterSpec>({});
  /** Static filter fields the user has hidden via the header icon */
  const [hiddenStaticFilters, setHiddenStaticFilters] = useState<Set<string>>(new Set());

  /** Merged filter columns: static (minus hidden) + dynamic (added via header icons) */
  const mergedFilterColumns = useMemo(() => {
    const visibleStatic = filterColumns.filter((c) => !hiddenStaticFilters.has(c.field));
    const staticFields = new Set(visibleStatic.map((c) => c.field));
    const newDynamic = dynamicFilterColumns.filter((c) => !staticFields.has(c.field));
    return [...visibleStatic, ...newDynamic];
  }, [filterColumns, dynamicFilterColumns, hiddenStaticFilters]);

  /** Set of field names that currently have a filter widget */
  const activeFilterFields = useMemo(
    () => new Set(mergedFilterColumns.map((c) => c.field)),
    [mergedFilterColumns],
  );

  const addFilterColumn = useCallback(
    (field: string) => {
      // If it's a hidden static filter, just un-hide it
      if (hiddenStaticFilters.has(field)) {
        setHiddenStaticFilters((prev) => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
        return;
      }

      // Already in the filter bar — nothing to do
      if (activeFilterFields.has(field)) return;

      // Derive config from allColumns metadata, or fall back to string filter
      const col = allColumns.find((c) => c.field === field);
      const config: ColumnFilterConfig = col
        ? columnToFilterConfig(col)
        : { field, displayName: field, filterType: 'string', widget: 'textbox', visible: true };

      setDynamicFilterColumns((prev) => [...prev, config]);
    },
    [activeFilterFields, hiddenStaticFilters, allColumns],
  );

  const removeFilterColumn = useCallback(
    (field: string) => {
      // Check if it's a static filter
      if (filterColumns.some((c) => c.field === field)) {
        setHiddenStaticFilters((prev) => new Set(prev).add(field));
      }
      // Also remove from dynamic list (in case it was added dynamically)
      setDynamicFilterColumns((prev) => prev.filter((c) => c.field !== field));
    },
    [filterColumns],
  );

  /** Set one field's filter spec in place (header funnel dropdown) */
  const setFieldFilter = useCallback(
    (field: string, fieldSpec: FieldFilterSpec | null) => {
      const next = { ...currentFilterSpec };
      if (fieldSpec) next[field] = fieldSpec;
      else delete next[field];
      setCurrentFilterSpec(next);
      // Sync the filter bar widgets with the new spec
      setInitialFilterSpec(next);
      if (Object.keys(next).length === 0) {
        viewState.clearFilter();
      } else {
        viewState.setFilter(next);
      }
      // Ensure the field has a widget in the filter bar (without opening controls)
      addFilterColumn(field);
    },
    [currentFilterSpec, viewState, addFilterColumn],
  );

  /** Unique values for a field's header value-checklist dropdown.
      Accumulated grow-only (like FilterBar) so filtering the data down
      doesn't remove previously-seen values from the checklist. */
  const accumulatedFilterOptionsRef = useRef<Record<string, Set<string>>>({});
  const getFilterOptions = useCallback(
    (field: string): string[] => {
      const col = mergedFilterColumns.find((c) => c.field === field);
      if (col?.options?.length) return col.options;
      const accumulated = accumulatedFilterOptionsRef.current;
      if (!accumulated[field]) accumulated[field] = new Set();
      const seen = accumulated[field];
      for (const row of (viewState.data?.data ?? []) as Record<string, unknown>[]) {
        const val = row?.[field];
        // Blank values surface as an "(empty)" checklist entry ('' matches via $in)
        seen.add(val == null || val === '' ? '' : String(val));
      }
      return Array.from(seen).sort();
    },
    [mergedFilterColumns, viewState.data],
  );

  /** Filter config for a field — existing bar config or derived from column metadata */
  const getFilterConfig = useCallback(
    (field: string): ColumnFilterConfig => {
      const existing = mergedFilterColumns.find((c) => c.field === field);
      if (existing) return existing;
      const col = allColumns.find((c) => c.field === field);
      return col
        ? columnToFilterConfig(col)
        : { field, displayName: field, filterType: 'string', widget: 'dropdown', visible: true };
    },
    [mergedFilterColumns, allColumns],
  );

  /** Open the full filter configuration (controls panel) for a field */
  const openFilterControls = useCallback(
    (field: string) => {
      addFilterColumn(field);
      setControlsVisible(true);
    },
    [addFilterColumn, setControlsVisible],
  );

  /** Context value for table header filter icons */
  const filterContextValue = useMemo<FilterContextValue>(
    () => ({
      addFilterColumn,
      removeFilterColumn,
      activeFilterFields,
      filterSpec: currentFilterSpec,
      setFieldFilter,
      getFilterOptions,
      getFilterConfig,
      openFilterControls,
    }),
    [addFilterColumn, removeFilterColumn, activeFilterFields, currentFilterSpec, setFieldFilter, getFilterOptions, getFilterConfig, openFilterControls],
  );
  const [sliderOpen, setSliderOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sliderHeader, _setSliderHeader] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sliderContent, _setSliderContent] = useState<React.ReactNode>(null);
  const [rowMode, setRowMode] = useState<'wrapped' | 'clipped'>(
    effectiveTableDef.rowMode ?? 'wrapped',
  );
  const rowBatchSize = effectiveTableDef.limit?.limit ?? DEFAULT_ROW_BATCH_SIZE;
  const [autoShowMore, setAutoShowMore] = useState(
    effectiveTableDef.limit?.autoShowMore ?? true,
  );
  const [visibleRowCount, setVisibleRowCount] = useState(rowBatchSize);

  // ── Control panel state ────────────────────────
  const [groupFields, setGroupFields] = useState<ControlFieldItem[]>([]);
  const [pivotFields, setPivotFields] = useState<ControlFieldItem[]>([]);
  const [aggregateEntries, setAggregateEntries] = useState<AggregateEntry[]>([]);
  /** When true, pivot fields were set without group — group was set implicitly */
  const [syntheticPivot, setSyntheticPivot] = useState(false);

  // ── Sort state ─────────────────────────────────
  const [sorts, setSorts] = useState<MultiSortSpec>([]);

  // ── Column config state (auto-derived from allColumns when prop is empty) ──
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  /** Persisted column configs after user saves via the dialog (preserves reorder, renames, etc.) */
  const [savedColumnConfigs, setSavedColumnConfigs] = useState<ColumnConfig[] | null>(null);

  // Derive effective column configs: saved state > explicit prop > auto-derived from allColumns
  const columnConfigs = useMemo<ColumnConfig[]>(() => {
    const base = savedColumnConfigs
      ?? (columnConfigsProp.length > 0
        ? columnConfigsProp
        : allColumns.map((c) => ({
            field: c.field,
            displayText: c.header ?? c.field,
            isPinned: c.pinned ?? false,
            isHidden: c.visible === false,
            allowHtml: c.allowHtml ?? false,
            allowFormatting: true,
            canHide: true,
          })));
    // Apply runtime hidden overrides
    return base.map((c) => ({
      ...c,
      isHidden: hiddenFields.has(c.field) ? true : c.isHidden,
    }));
  }, [savedColumnConfigs, columnConfigsProp, allColumns, hiddenFields]);

  const setColumnHidden = useCallback((field: string, hidden: boolean) => {
    setHiddenFields((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(field); else next.delete(field);
      return next;
    });
  }, []);

  /** Ordered list of visible field names derived from column configs */
  const columnOrder = useMemo(
    () => columnConfigs.filter((c) => !c.isHidden).map((c) => c.field),
    [columnConfigs],
  );

  /** Update column order (e.g. from table drag-reorder) — reorders savedColumnConfigs to match */
  const setColumnOrder = useCallback((fields: string[]) => {
    // Build a priority map from the new order
    const orderIndex = new Map(fields.map((f, i) => [f, i]));
    setSavedColumnConfigs((prev) => {
      const base = prev ?? columnConfigs;
      // Separate visible (ordered) from hidden (appended at end)
      const visible = base.filter((c) => orderIndex.has(c.field));
      const rest = base.filter((c) => !orderIndex.has(c.field));
      visible.sort((a, b) => (orderIndex.get(a.field) ?? 0) - (orderIndex.get(b.field) ?? 0));
      return [...visible, ...rest];
    });
  }, [columnConfigs]);

  /** Set of pinned field names derived from column configs */
  const pinnedFields = useMemo(
    () => new Set(columnConfigs.filter((c) => c.isPinned).map((c) => c.field)),
    [columnConfigs],
  );

  /** Toggle a column's pinned state and reorder so pinned columns come first */
  const setColumnPinned = useCallback((field: string, pinned: boolean) => {
    setSavedColumnConfigs((prev) => {
      const base = (prev ?? columnConfigs).map((c) =>
        c.field === field ? { ...c, isPinned: pinned } : { ...c },
      );
      // Re-sort: pinned first, preserving relative order within each group
      const pinnedCols = base.filter((c) => c.isPinned);
      const unpinnedCols = base.filter((c) => !c.isPinned);
      return [...pinnedCols, ...unpinnedCols];
    });
  }, [columnConfigs]);

  const columnConfigContextValue = useMemo<ColumnConfigContextValue>(
    () => ({ hiddenFields, setColumnHidden, columnOrder, setColumnOrder, pinnedFields, setColumnPinned }),
    [hiddenFields, setColumnHidden, columnOrder, setColumnOrder, pinnedFields, setColumnPinned],
  );

  // ── Dialog state ───────────────────────────────
  const [colConfigOpen, setColConfigOpen] = useState(false);
  const [tableOptsOpen, setTableOptsOpen] = useState(false);

  // ── User multi-row selection preference ───────────
  // Only offered (via the table options dialog) when the embedding code
  // hasn't set features.rowSelection on the table renderer itself.
  const [userRowSelection, setUserRowSelection] = useState(false);
  const rowSelectionSetByCode = useMemo(() => {
    let set = false;
    Children.forEach(children, (child) => {
      if (
        isValidElement(child) &&
        (child.props as Partial<TableRendererProps>).features?.rowSelection !== undefined
      ) {
        set = true;
      }
    });
    return set;
  }, [children]);

  const [groupFnOpen, setGroupFnOpen] = useState(false);
  /** Which field the group function dialog is editing */
  const [groupFnField, setGroupFnField] = useState<string | undefined>();
  /** The current function name for the field being edited */
  const [groupFnCurrent, setGroupFnCurrent] = useState<string | undefined>();
  /** Whether we're editing a group vs pivot function */
  const [groupFnTarget, setGroupFnTarget] = useState<'group' | 'pivot'>('group');
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);
  const [tableDefVersion, setTableDefVersion] = useState(0);

  /** Per-field group function map: field → function name */
  const [groupFunMap, setGroupFunMap] = useState<Record<string, string>>({});
  /** Per-field pivot function map: field → function name */
  const [pivotFunMap, setPivotFunMap] = useState<Record<string, string>>({});

  const syncControlStateFromView = useCallback(() => {
    const groupSpecs = parseGroupSpec(view.getGroup?.() ?? null);
    const pivotSpecs = parseGroupSpec(view.getPivot?.() ?? null);

    setGroupFields(groupSpecs.map(({ field }) => ({
      field,
      displayName: controlFields.find((cf) => cf.field === field)?.displayName ?? field,
    })));
    setGroupFunMap(
      Object.fromEntries(
        groupSpecs
          .filter((spec): spec is { field: string; fun: string } => typeof spec.fun === 'string')
          .map((spec) => [spec.field, spec.fun]),
      ),
    );

    setPivotFields(pivotSpecs.map(({ field }) => ({
      field,
      displayName: controlFields.find((cf) => cf.field === field)?.displayName ?? field,
    })));
    setPivotFunMap(
      Object.fromEntries(
        pivotSpecs
          .filter((spec): spec is { field: string; fun: string } => typeof spec.fun === 'string')
          .map((spec) => [spec.field, spec.fun]),
      ),
    );

    setAggregateEntries(
      gridMode === 'full'
        ? parseAggregateEntries(view.getAggregate?.() ?? null)
        : [],
    );
    setInitialFilterSpec(parseFilterSpec(view.getFilter?.() ?? null));
    setCurrentFilterSpec(parseFilterSpec(view.getFilter?.() ?? null));
    setSyntheticPivot(false);

    // Default and minimal modes hide the aggregate footer (e.g. the count row)
    // by default. Strip any default aggregate the view seeds so the table starts
    // without a footer; the user can still turn aggregates on via the aggregate
    // control. Guarded because clearing the aggregate can trigger a prefs save
    // before the prefs backend has been primed (e.g. on initial mount).
    if (gridMode !== 'full' && view.getAggregate?.()) {
      try {
        view.setAggregate?.(null);
      } catch {
        // Prefs backend not ready yet. syncControlStateFromView re-runs on the
        // `primed`/`perspectiveChanged` events, which will strip the aggregate
        // once the save can succeed.
      }
    }
  }, [view, controlFields, gridMode]);

  useEffect(() => {
    syncControlStateFromView();
  }, [syncControlStateFromView]);

  useDataVisEvent(prefs, 'perspectiveChanged', () => {
    syncControlStateFromView();
    view.getData();
  });

  useDataVisEvent(prefs, 'prefsReset', () => {
    syncControlStateFromView();
    view.getData();
  });

  // Enrich group fields with function subtitles
  const enrichedGroupFields = useMemo(
    () =>
      groupFields.map((f) => ({
        ...f,
        subtitle: getGroupFunctionLabel(groupFunctionDefs, groupFunMap[f.field]),
      })),
    [groupFields, groupFunMap, groupFunctionDefs],
  );

  const enrichedPivotFields = useMemo(
    () =>
      pivotFields.map((f) => ({
        ...f,
        subtitle: getGroupFunctionLabel(groupFunctionDefs, pivotFunMap[f.field]),
      })),
    [pivotFields, pivotFunMap, groupFunctionDefs],
  );

  // Derive data mode (plain/group/pivot) from view data
  const dataMode = useMemo(() => {
    if (!viewState.data) return 'plain';
    if (viewState.data.isPivot) return 'pivot';
    if (syntheticPivot && viewState.data.isGroup) return 'pivot';
    if (viewState.data.isGroup) return 'group';
    return 'plain';
  }, [viewState.data, syntheticPivot]);

  // ── Handlers ───────────────────────────────────
  const handleToggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      onToggle?.(!next);
      return next;
    });
  }, [onToggle]);

  const handleToggleControls = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  const handleRefresh = useCallback(() => {
    viewState.refresh();
  }, [viewState]);

  /** Build CSV from full (un-limited) view data and visible columns */
  const getExportCsv = useCallback(() => {
    const data = viewState.data;
    if (!data?.isPlain || !Array.isArray(data.data)) return null;
    const visibleCols = columnConfigs
      .filter((c) => !c.isHidden)
      .map((c) => allColumns.find((col) => col.field === c.field))
      .filter((col): col is TableColumn => col != null);
    const rows = data.data.map((row, idx) => ({
      rowNum: idx,
      data: row as Record<string, unknown>,
    }));
    return { csv: rowsToCsv(rows, visibleCols, locale), visibleCols, rows };
  }, [viewState.data, columnConfigs, allColumns, locale]);

  const handleExportCsv = useCallback(() => {
    const result = getExportCsv();
    if (!result) return;
    downloadCsv(result.csv, buildCsvFilename(title));
  }, [getExportCsv, title]);

  const handleCopyClipboard = useCallback(async () => {
    const result = getExportCsv();
    if (!result) return;
    await copyToClipboard(result.csv);
  }, [getExportCsv]);

  const handleToolbarRedraw = useCallback(() => {
    setTableDefVersion((current) => current + 1);
    view.getData();
  }, [view]);

  const handleRowModeChange = useCallback((mode: 'wrapped' | 'clipped') => {
    setRowMode(mode);
  }, []);

  const handleAutoShowMoreChange = useCallback((checked: boolean) => {
    setAutoShowMore(checked);
  }, []);

  const handleShowMoreRows = useCallback(() => {
    const totalVisibleRows = Array.isArray(viewState.data?.data) ? viewState.data.data.length : 0;
    setVisibleRowCount((current) => Math.min(current + rowBatchSize, totalVisibleRows));
  }, [rowBatchSize, viewState.data]);

  const handleShowAllRows = useCallback(() => {
    const totalVisibleRows = Array.isArray(viewState.data?.data) ? viewState.data.data.length : 0;
    setVisibleRowCount(totalVisibleRows);
  }, [viewState.data]);

  useEffect(() => {
    setAutoShowMore(effectiveTableDef.limit?.autoShowMore ?? true);
  }, [effectiveTableDef.limit?.autoShowMore]);

  useEffect(() => {
    setVisibleRowCount(rowBatchSize);
  }, [rowBatchSize, viewState.data]);

  const limitedViewData = useMemo(
    () => limitPlainViewData(viewState.data, visibleRowCount),
    [viewState.data, visibleRowCount],
  );

  /** Row numbers selected in the child table — lifted so the operations
   * palette can act on the selected rows' data. */
  const [selectedRowNums, setSelectedRowNums] = useState<Set<number>>(
    () => new Set(),
  );

  const selectedRowData = useMemo(() => {
    if (
      selectedRowNums.size === 0 ||
      !limitedViewData?.isPlain ||
      !Array.isArray(limitedViewData.data)
    ) {
      return [];
    }
    // Rows are identified by stable ids (not positions) so selection
    // follows the row content across filtering — resolve by id.
    const data = limitedViewData.data as unknown[];
    return data.filter((row, idx) => selectedRowNums.has(getStableRowId(row, idx)));
  }, [selectedRowNums, limitedViewData]);

  const renderedChildren = useMemo(
    () => Children.map(children, (child) => {
      if (!isValidElement(child) || typeof child.type === 'string') {
        return child;
      }

      const childProps = child.props as Partial<TableRendererProps>;

      return cloneElement(child as React.ReactElement<TableRendererProps>, {
        viewData: preserveChildViewData && childProps.viewData !== undefined ? childProps.viewData : limitedViewData,
        // User-enabled multi-row selection (table options dialog) — only
        // applied when the embedding code didn't set rowSelection itself
        ...(childProps.features?.rowSelection === undefined && userRowSelection
          ? { features: { ...childProps.features, rowSelection: 'checkbox' as const } }
          : {}),
        // Track selection so the operations palette receives the selected row
        // data — chained with any handler the consumer supplied. Only plain
        // mode updates the lifted selection, so group/pivot round trips (and
        // clicks within them) don't clobber it.
        onSelectionChange: (sel: SelectionState) => {
          if (limitedViewData?.isPlain) {
            setSelectedRowNums(new Set(sel.selectedRows));
          }
          childProps.onSelectionChange?.(sel);
        },
        // Reseed the plain table's selection when it remounts after a
        // group/pivot round trip
        initialSelectedRows: childProps.initialSelectedRows ?? selectedRowNums,
        limit: childProps.limit ?? { limit: rowBatchSize, autoShowMore },
        loadedRows: childProps.loadedRows ?? (limitedViewData?.isPlain && Array.isArray(limitedViewData.data)
          ? limitedViewData.data.length
          : undefined),
        groupMode: childProps.groupMode ?? effectiveTableDef.groupMode,
        showTotalRow: childProps.showTotalRow ?? effectiveTableDef.whenGroup?.showTotalRow,
        showTotalCol: childProps.showTotalCol ?? effectiveTableDef.whenPivot?.showTotalCol,
        groupsExpanded: childProps.groupsExpanded ?? effectiveTableDef.whenGroup?.showExpandedGroups,
        syntheticPivot,
        onShowMore: childProps.onShowMore ?? handleShowMoreRows,
        onShowAll: childProps.onShowAll ?? handleShowAllRows,
        // Default mode shows the row count next to the title, so suppress the
        // "Showing N rows" footer count in the table.
        showRowCount: childProps.showRowCount ?? gridMode !== 'default',
      });
    }),
    [
      children,
      limitedViewData,
      rowBatchSize,
      autoShowMore,
      preserveChildViewData,
      effectiveTableDef,
      tableDefVersion,
      syntheticPivot,
      handleShowMoreRows,
      handleShowAllRows,
      gridMode,
      userRowSelection,
      selectedRowNums,
    ],
  );

  // openSlider is available for table renderers and other child components
  // that need to show row detail. It's passed via context or callbacks.
  // const openSlider = useCallback(
  //   (header: string, content: React.ReactNode) => {
  //     setSliderHeader(header);
  //     setSliderContent(content);
  //     setSliderOpen(true);
  //   },
  //   [],
  // );

  const closeSlider = useCallback(() => {
    setSliderOpen(false);
  }, []);

  // ── Control panel handlers ─────────────────────
  const handleFilterChange = useCallback(
    (spec: FilterSpec) => {
      setCurrentFilterSpec(spec);
      if (Object.keys(spec).length === 0) {
        viewState.clearFilter();
      } else {
        viewState.setFilter(spec);
      }
    },
    [viewState],
  );

  const handleGroupChange = useCallback(
    (fields: string[]) => {
      // Preserve existing function assignments for fields that remain
      const newGroupFields = fields.map((f) => ({
        field: f,
        displayName: controlFields.find((cf) => cf.field === f)?.displayName ?? f,
      }));
      setGroupFields(newGroupFields);

      // Clean up function map: remove entries for removed fields
      setGroupFunMap((prev) => {
        const next: Record<string, string> = {};
        for (const f of fields) {
          if (prev[f]) next[f] = prev[f];
        }
        return next;
      });

      if (fields.length === 0) {
        // If pivot fields exist, switch to synthetic pivot:
        // clear the real pivot, then group by the pivot fields behind the scenes
        if (pivotFields.length > 0) {
          viewState.clearPivot();
          const pivotSpec = pivotFields.map((f) => ({ field: f.field, fun: pivotFunMap[f.field] }));
          viewState.setGroup(buildGroupSpec(pivotSpec));
          setSyntheticPivot(true);
        } else {
          viewState.clearGroup();
          setSyntheticPivot(false);
        }
      } else {
        // User explicitly set group fields — exit synthetic mode
        setSyntheticPivot(false);
        // Build spec with function assignments
        const specFields = fields.map((f) => ({ field: f, fun: groupFunMap[f] }));
        viewState.setGroup(buildGroupSpec(specFields));
      }

      // Auto-open group function dialog for newly added date/datetime/time fields
      if (fields.length > groupFields.length) {
        const newField = fields[fields.length - 1];
        const cf = controlFields.find((c) => c.field === newField);
        const fieldType = cf?.type;
        if (fieldType && needsGroupFunction(fieldType)) {
          setGroupFnField(newField);
          setGroupFnCurrent(undefined);
          setGroupFnTarget('group');
          setGroupFnOpen(true);
        }
      }
    },
    [controlFields, viewState, groupFunMap, groupFields.length, pivotFields, pivotFunMap],
  );

  const handlePivotChange = useCallback(
    (fields: string[]) => {
      const newPivotFields = fields.map((f) => ({
        field: f,
        displayName: controlFields.find((cf) => cf.field === f)?.displayName ?? f,
      }));
      setPivotFields(newPivotFields);

      // Clean up function map
      setPivotFunMap((prev) => {
        const next: Record<string, string> = {};
        for (const f of fields) {
          if (prev[f]) next[f] = prev[f];
        }
        return next;
      });

      if (fields.length === 0) {
        // Pivot cleared — remove synthetic group if it was in place
        if (syntheticPivot) {
          viewState.clearGroup();
          setSyntheticPivot(false);
        }
        viewState.clearPivot();
      } else if (groupFields.length === 0) {
        // Pivot without group — use pivot fields as an implicit group
        const specFields = fields.map((f) => ({ field: f, fun: pivotFunMap[f] }));
        viewState.setGroup(buildGroupSpec(specFields));
        setSyntheticPivot(true);
      } else {
        // Real pivot with existing group
        setSyntheticPivot(false);
        const specFields = fields.map((f) => ({ field: f, fun: pivotFunMap[f] }));
        viewState.setPivot(buildGroupSpec(specFields));
      }

      // Auto-open for newly added date/datetime/time pivot fields
      if (fields.length > pivotFields.length) {
        const newField = fields[fields.length - 1];
        const cf = controlFields.find((c) => c.field === newField);
        const fieldType = cf?.type;
        if (fieldType && needsGroupFunction(fieldType)) {
          setGroupFnField(newField);
          setGroupFnCurrent(undefined);
          setGroupFnTarget('pivot');
          setGroupFnOpen(true);
        }
      }
    },
    [controlFields, viewState, pivotFunMap, pivotFields.length, groupFields.length, syntheticPivot],
  );

  const handleAggregateChange = useCallback(
    (entries: AggregateEntry[]) => {
      setAggregateEntries(entries);
      if (entries.length === 0) {
        viewState.setAggregate(null);
      } else {
        const spec = entries
          .filter((e) => e.visible)
          .map((e) => ({
            fn: e.functionName,
            fields: e.fields,
          }));
        viewState.setAggregate(toLegacyAggregateSpec(spec));
      }
    },
    [viewState],
  );

  // ── Sort handler ───────────────────────────────
  const handleSortChange = useCallback(
    (field: string, direction: SortDirection, additive = false) => {
      // Build the next priority-ordered sort list.
      let next: MultiSortSpec;
      if (additive) {
        const idx = sorts.findIndex((s) => s.field === field);
        if (idx >= 0) {
          // Toggle / update direction in place, preserving priority.
          next = sorts.slice();
          next[idx] = { field, direction };
        } else {
          // Append as the lowest-priority sort key.
          next = [...sorts, { field, direction }];
        }
      } else {
        // Non-additive click replaces the whole sort with just this column.
        next = [{ field, direction }];
      }
      setSorts(next);
      // Convert to legacy View~SortSpec format: { vertical: [{ field, dir }, …] }
      viewState.setSort({
        vertical: next.map((s) => ({ field: s.field, dir: s.direction.toUpperCase() })),
      });
    },
    [sorts, viewState.setSort],
  );

  /** Sort context for table renderers */
  const sortContextValue = useMemo<SortContextValue>(
    () => ({ sorts, onSort: handleSortChange }),
    [sorts, handleSortChange],
  );

  // ── Dialog open helpers ────────────────────────
  const openColumnConfig = useCallback(() => setColConfigOpen(true), []);
  const openTableOpts = useCallback(() => setTableOptsOpen(true), []);
  const openPerspective = useCallback(() => setPerspectiveOpen(true), []);

  const handleColumnConfigSave = useCallback(
    (cols: ColumnConfig[], clearCache: string[]) => {
      // Persist the full column config state (order, renames, flags)
      setSavedColumnConfigs(cols.map((c) => ({ ...c })));
      // Sync hiddenFields from dialog result
      setHiddenFields(new Set(cols.filter((c) => c.isHidden).map((c) => c.field)));

      // Push column config to the legacy view for rendering compatibility
      try {
        const serialized = {
          _keys: cols.map((c) => c.field),
          _values: cols.map((c) => ({
            displayText: c.displayText,
            isPinned: c.isPinned,
            isHidden: c.isHidden,
            allowHtml: c.allowHtml,
            allowFormatting: c.allowFormatting,
            canHide: c.canHide,
          })),
        };
        view.setColConfig(serialized);
      } catch {
        // Legacy view may not have setColConfig; ignore
      }
      onColumnConfigSave?.(cols, clearCache);
    },
    [view, onColumnConfigSave],
  );

  const handleDisplayFormatSave = useCallback(
    (df: DisplayFormatConfig) => {
      onDisplayFormatSave?.(df);
    },
    [onDisplayFormatSave],
  );

  const handleGroupFnSelect = useCallback(
    (fnName: string | null) => {
      if (!groupFnField) return;

      const effectiveFn = fnName === 'none' ? undefined : (fnName ?? undefined);

      if (groupFnTarget === 'group') {
        // Update group function map
        setGroupFunMap((prev) => {
          const next = { ...prev };
          if (effectiveFn) {
            next[groupFnField] = effectiveFn;
          } else {
            delete next[groupFnField];
          }
          return next;
        });

        // Re-send group spec to view with updated function
        const fields = groupFields.map((f) => f.field);
        const specFields = fields.map((f) => ({
          field: f,
          fun: f === groupFnField ? effectiveFn : groupFunMap[f],
        }));
        viewState.setGroup(buildGroupSpec(specFields));
      } else {
        // Update pivot function map
        setPivotFunMap((prev) => {
          const next = { ...prev };
          if (effectiveFn) {
            next[groupFnField] = effectiveFn;
          } else {
            delete next[groupFnField];
          }
          return next;
        });

        const fields = pivotFields.map((f) => f.field);
        const specFields = fields.map((f) => ({
          field: f,
          fun: f === groupFnField ? effectiveFn : pivotFunMap[f],
        }));
        viewState.setPivot(buildGroupSpec(specFields));
      }

      // Also notify external handler if provided
      onGroupFunctionSelect?.(groupFnField, fnName);
    },
    [groupFnField, groupFnTarget, groupFields, pivotFields, groupFunMap, pivotFunMap, viewState, onGroupFunctionSelect],
  );

  // ── Group function click handlers ──────────────
  const handleGroupFunctionClick = useCallback(
    (field: string) => {
      setGroupFnField(field);
      setGroupFnCurrent(groupFunMap[field]);
      setGroupFnTarget('group');
      setGroupFnOpen(true);
    },
    [groupFunMap],
  );

  const handlePivotFunctionClick = useCallback(
    (field: string) => {
      setGroupFnField(field);
      setGroupFnCurrent(pivotFunMap[field]);
      setGroupFnTarget('pivot');
      setGroupFnOpen(true);
    },
    [pivotFunMap],
  );

  /** Filter group function defs to those applicable for the selected field's type */
  const filteredGroupFnDefs = useMemo(() => {
    if (!groupFnField) return groupFunctionDefs;
    const cf = controlFields.find((c) => c.field === groupFnField);
    const fieldType = cf?.type;
    if (!fieldType) return groupFunctionDefs;
    return filterGroupFunctionsForType(groupFunctionDefs, fieldType);
  }, [groupFnField, controlFields, groupFunctionDefs]);

  // ── Filter status ──────────────────────────────
  const hasActiveFilter = useMemo(() => {
    // Check if view has an active filter
    try {
      const filterSpec = (view as unknown as Record<string, unknown>).filterSpec;
      return filterSpec != null;
    } catch {
      return false;
    }
  }, [viewState.data]);

  const clearFilter = useCallback(() => {
    viewState.clearFilter();
    // Keep the filter bar widgets and header funnel popups in sync
    setCurrentFilterSpec({});
    setInitialFilterSpec({});
  }, [viewState]);

  /** Auto-open controls when a column header drag starts or enters the grid */
  const handleColumnDragStart = useCallback(() => {
    if (!controlsVisibleRef.current) setControlsVisible(true);
  }, []);

  const handleGridDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(COLUMN_DRAG_MIME)) return;
      if (!controlsVisibleRef.current) setControlsVisible(true);
    },
    [],
  );

  const columnDropContextValue = useMemo<ColumnDropContextValue>(
    () => ({ onColumnDragStart: handleColumnDragStart }),
    [handleColumnDragStart],
  );

  /** Memoised provider-wrapped table content — isolates the table subtree from
   *  unrelated state changes (e.g. controlsVisible toggling). */
  const tableContent = useMemo(
    () => (
      <SortContext.Provider value={sortContextValue}>
      <FilterContext.Provider value={filterContextValue}>
      <ColumnConfigContext.Provider value={columnConfigContextValue}>
      <ColumnDropProvider value={columnDropContextValue}>
        {renderedChildren}
      </ColumnDropProvider>
      </ColumnConfigContext.Provider>
      </FilterContext.Provider>
      </SortContext.Provider>
    ),
    [sortContextValue, filterContextValue, columnConfigContextValue, columnDropContextValue, renderedChildren],
  );

  // ── Render ─────────────────────────────────────
  const gridTableId = `wcdv-grid-table-${title?.replace(/\s+/g, '-') || 'main'}`;

  return (
    <LocaleProvider value={locale}>
    <div
      className={`wcdv-grid flex flex-col border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none ${className}`}
      role="region"
      aria-label={title || t('GRID.TITLEBAR.TITLE')}
      onDragOver={handleGridDragOver}
    >
      {/* Skip to data table */}
      <a
        href={`#${gridTableId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white dark:focus:bg-neutral-800 focus:px-4 focus:py-2 focus:text-blue-700 dark:focus:text-blue-400 focus:shadow-lg focus:rounded"
      >
        {t('GRID.SKIP_TO_TABLE') || 'Skip to data table'}
      </a>

      {/* Title Bar — hidden in minimal mode (replaced by a floating ellipsis
          menu rendered over the data table below). In default mode the title
          bar renders a compact title and the hamburger menu; in full mode it
          shows the row count and inline perspective/action buttons. */}
      {gridMode !== 'minimal' && (
        <TitleBar
          variant={gridMode === 'default' ? 'default' : 'full'}
          title={title}
          helpText={helpText}
          loading={viewState.loading || sourceState.fetching}
          rowCount={viewState.workInfo?.numRows ?? 0}
          totalRowCount={viewState.workInfo?.totalRows ?? 0}
          hasActiveFilter={hasActiveFilter}
          cancellable={sourceState.source.isCancellable()}
          collapsed={collapsed}
          controlsVisible={controlsOpen}
          prefs={prefs}
          onToggle={handleToggle}
          onToggleControls={handleToggleControls}
          onRefresh={handleRefresh}
          onCancel={sourceState.cancel}
          onClearFilter={clearFilter}
          onOpenPerspective={openPerspective}
          onExportCsv={handleExportCsv}
          onCopyClipboard={handleCopyClipboard}
        />
      )}

      {/* Collapsible Content */}
      {!collapsed && (
        <div className="wcdv-grid-content flex flex-col flex-1 min-h-0">
          {/* Controls area — toggled via CSS class, not React state */}
          <div ref={controlsWrapperRef} className={controlsInitiallyVisible ? undefined : 'hidden'}>
            {/* Toolbar */}
            {showToolbar && (
              <GridToolbar
                autoShowMore={autoShowMore}
                dataMode={dataMode}
                tableDef={effectiveTableDef}
                rowMode={rowMode}
                view={view}
                onAutoShowMoreChange={handleAutoShowMoreChange}
                onRowModeChange={handleRowModeChange}
                onRedraw={handleToolbarRedraw}
                onShowAllRows={handleShowAllRows}
                onOpenColumnConfig={openColumnConfig}
                onOpenTableOptions={openTableOpts}
              />
            )}

            {/* Control Panel */}
            <ControlPanel
              filterColumns={mergedFilterColumns}
              allFilterableFields={allColumns.map((c) => ({ field: c.field, displayName: c.header ?? c.field }))}
              rowData={viewState.data?.data}
              initialFilterSpec={initialFilterSpec}
              availableFields={controlFields}
              aggregateFields={aggregateFields}
              groupFields={enrichedGroupFields}
              pivotFields={enrichedPivotFields}
              aggregateEntries={aggregateEntries}
              aggregateFunctions={aggregateFunctions}
              onFilterChange={handleFilterChange}
              onRemoveFilterColumn={removeFilterColumn}
              onAddFilterColumn={addFilterColumn}
              onGroupChange={handleGroupChange}
              onPivotChange={handlePivotChange}
              onAggregateChange={handleAggregateChange}
              onGroupFunctionClick={handleGroupFunctionClick}
              onPivotFunctionClick={handlePivotFunctionClick}
            />

            {/* Operations Palette */}
            {operations.length > 0 && (
              <OperationsPalette operations={operations} selectedRows={selectedRowData} />
            )}
          </div>

          {/* Loading overlay */}
          <LoadingOverlay
            loading={viewState.loading}
            fetching={sourceState.fetching}
          />

          {/* Data content area — when a fixed `height` is supplied it applies
              to the table (scroll area) itself, not the whole grid, so the
              toolbar/controls stack above and add to the overall height. */}
          <div
            ref={gridTableRef}
            id={gridTableId}
            className="wcdv-grid-table flex flex-col flex-1 min-h-0 relative"
            style={height ? { height, flex: 'none' } : undefined}
            aria-busy={viewState.loading}
          >
            {/* Floating ellipsis menu (minimal mode) — sits over the table,
                clear of the controls toolbar above */}
            {gridMode === 'minimal' && (
              <MinimalMenu
                prefs={prefs}
                onToggleControls={handleToggleControls}
                onRefresh={handleRefresh}
                onOpenPerspective={openPerspective}
                onExportCsv={handleExportCsv}
                onCopyClipboard={handleCopyClipboard}
              />
            )}
            {tableContent}
          </div>
        </div>
      )}

      {/* Detail Slider */}
      <DetailSlider
        open={sliderOpen}
        header={sliderHeader}
        onClose={closeSlider}
      >
        {sliderContent}
      </DetailSlider>

      {/* ── Dialogs (Phase 3) ── */}
      <ColumnConfigDialog
        open={colConfigOpen}
        onOpenChange={setColConfigOpen}
        columns={columnConfigs}
        onSave={handleColumnConfigSave}
      />

      <GridTableOptionsDialog
        open={tableOptsOpen}
        onOpenChange={setTableOptsOpen}
        displayFormat={displayFormat}
        onSave={handleDisplayFormatSave}
        rowSelection={userRowSelection}
        showRowSelectionOption={!rowSelectionSetByCode}
        onRowSelectionChange={setUserRowSelection}
      />

      <GroupFunctionDialog
        open={groupFnOpen}
        onOpenChange={setGroupFnOpen}
        groupFunctions={filteredGroupFnDefs}
        currentFunction={groupFnCurrent}
        fieldName={groupFnField}
        onSelect={handleGroupFnSelect}
      />

      {prefs && (
        <PerspectiveDialogHost
          prefs={prefs}
          open={perspectiveOpen}
          onOpenChange={setPerspectiveOpen}
        />
      )}
    </div>
    </LocaleProvider>
  );
}
