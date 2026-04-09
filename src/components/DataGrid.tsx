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
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';

import { useView, useSource, type ViewData, type ViewInstance } from '../adapters/use-data';
import { type PrefsInstance } from '../adapters/use-prefs';
import {
  buildGroupSpec,
  getGroupFunctionLabel,
  filterGroupFunctionsForType,
  needsGroupFunction,
} from '../adapters/group-adapter';
import { toLegacyAggregateSpec } from '../adapters/wcdatavis-interop';
import { useTranslation } from 'react-i18next';
import { LocaleProvider } from '../i18n';
import { TitleBar } from './TitleBar';
import { GridToolbar } from './GridToolbar';
import { ControlPanel } from './controls/ControlPanel';
import { type ControlFieldItem } from './controls/ControlSection';
import { type AggregateEntry, type AggregateFunction } from './controls/AggregateSection';
import { type ColumnFilterConfig, type FilterSpec } from './filters/types';
import { FilterContext, columnToFilterConfig, type FilterContextValue } from './filters/FilterContext';
import type { TableColumn, SortSpec, SortDirection } from './table/types';
import { SortContext, type SortContextValue } from './table/SortContext';
import { ColumnConfigContext, type ColumnConfigContextValue } from './table/ColumnConfigContext';
import { OperationsPalette, type Operation } from './OperationsPalette';
import { DetailSlider } from './DetailSlider';
import { LoadingOverlay } from './LoadingOverlay';
import { ColumnConfigDialog, type ColumnConfig } from './dialogs/ColumnConfigDialog';
import type { TemplateData } from './dialogs/TemplateEditorDialog';
import { GridTableOptionsDialog, type DisplayFormatConfig } from './dialogs/GridTableOptionsDialog';
import { GroupFunctionDialog } from './dialogs/GroupFunctionDialog';
import type { GroupFunction as GroupFunctionDef } from './dialogs/GroupFunctionDialog';
import { PerspectiveManagerDialog, type PerspectiveInfo } from './dialogs/PerspectiveManagerDialog';
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
  const [collapsed, setCollapsed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(initialShowControls);

  // ── Dynamic filter columns ─────────────────────
  const [dynamicFilterColumns, setDynamicFilterColumns] = useState<ColumnFilterConfig[]>([]);
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
        setControlsVisible(true);
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

      // Auto-open controls so the user sees the new filter
      setControlsVisible(true);
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

  /** Context value for table header filter icons */
  const filterContextValue = useMemo<FilterContextValue>(
    () => ({ addFilterColumn, removeFilterColumn, activeFilterFields }),
    [addFilterColumn, removeFilterColumn, activeFilterFields],
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

  // ── Sort state ─────────────────────────────────
  const [sort, setSort] = useState<SortSpec | null>(null);

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

  const columnConfigContextValue = useMemo<ColumnConfigContextValue>(
    () => ({ hiddenFields, setColumnHidden, columnOrder, setColumnOrder }),
    [hiddenFields, setColumnHidden, columnOrder, setColumnOrder],
  );

  // ── Dialog state ───────────────────────────────
  const [colConfigOpen, setColConfigOpen] = useState(false);
  const [tableOptsOpen, setTableOptsOpen] = useState(false);
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
    if (viewState.data.isGroup) return 'group';
    return 'plain';
  }, [viewState.data]);

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

  const renderedChildren = useMemo(
    () => Children.map(children, (child) => {
      if (!isValidElement(child) || typeof child.type === 'string') {
        return child;
      }

      const childProps = child.props as Partial<TableRendererProps>;

      return cloneElement(child as React.ReactElement<TableRendererProps>, {
        viewData: preserveChildViewData && childProps.viewData !== undefined ? childProps.viewData : limitedViewData,
        limit: childProps.limit ?? { limit: rowBatchSize, autoShowMore },
        loadedRows: childProps.loadedRows ?? (limitedViewData?.isPlain && Array.isArray(limitedViewData.data)
          ? limitedViewData.data.length
          : undefined),
        groupMode: childProps.groupMode ?? effectiveTableDef.groupMode,
        showTotalRow: childProps.showTotalRow ?? effectiveTableDef.whenGroup?.showTotalRow,
        showTotalCol: childProps.showTotalCol ?? effectiveTableDef.whenPivot?.showTotalCol,
        groupsExpanded: childProps.groupsExpanded ?? effectiveTableDef.whenGroup?.showExpandedGroups,
        onShowMore: childProps.onShowMore ?? handleShowMoreRows,
        onShowAll: childProps.onShowAll ?? handleShowAllRows,
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
      handleShowMoreRows,
      handleShowAllRows,
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
        viewState.clearGroup();
      } else {
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
    [controlFields, viewState, groupFunMap, groupFields.length],
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
        viewState.clearPivot();
      } else {
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
    [controlFields, viewState, pivotFunMap, pivotFields.length],
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
    (field: string, direction: SortDirection) => {
      const spec: SortSpec = { field, direction };
      setSort(spec);
      // Convert to legacy View~SortSpec format: { vertical: { field, dir: 'ASC'|'DESC' } }
      viewState.setSort({
        vertical: { field, dir: direction.toUpperCase() },
      });
    },
    [viewState],
  );

  /** Sort context for table renderers */
  const sortContextValue = useMemo<SortContextValue>(
    () => ({ sort, onSort: handleSortChange }),
    [sort, handleSortChange],
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
  }, [viewState]);

  // ── Render ─────────────────────────────────────
  const gridTableId = `wcdv-grid-table-${title?.replace(/\s+/g, '-') || 'main'}`;

  return (
    <LocaleProvider value={locale}>
    <div
      className={`wcdv-grid flex flex-col border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none ${className}`}
      style={height ? { height } : undefined}
      role="region"
      aria-label={title || t('GRID.TITLEBAR.TITLE')}
    >
      {/* Skip to data table */}
      <a
        href={`#${gridTableId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white dark:focus:bg-neutral-800 focus:px-4 focus:py-2 focus:text-blue-700 dark:focus:text-blue-400 focus:shadow-lg focus:rounded"
      >
        {t('GRID.SKIP_TO_TABLE') || 'Skip to data table'}
      </a>

      {/* Title Bar */}
      <TitleBar
        title={title}
        helpText={helpText}
        loading={viewState.loading || sourceState.fetching}
        rowCount={viewState.workInfo?.numRows ?? 0}
        totalRowCount={viewState.workInfo?.totalRows ?? 0}
        hasActiveFilter={hasActiveFilter}
        cancellable={sourceState.source.isCancellable()}
        collapsed={collapsed}
        prefs={prefs}
        onToggle={handleToggle}
        onToggleControls={handleToggleControls}
        onRefresh={handleRefresh}
        onCancel={sourceState.cancel}
        onClearFilter={clearFilter}
        onOpenPerspective={openPerspective}
      />

      {/* Collapsible Content */}
      {!collapsed && (
        <div className="wcdv-grid-content flex flex-col flex-1 min-h-0">
          {/* Toolbar (hidden with controls) */}
          {controlsVisible && showToolbar && (
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
          {controlsVisible && (
            <ControlPanel
              filterColumns={mergedFilterColumns}
              allFilterableFields={allColumns.map((c) => ({ field: c.field, displayName: c.header ?? c.field }))}
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
          )}

          {/* Operations Palette (hidden with controls) */}
          {controlsVisible && operations.length > 0 && (
            <OperationsPalette operations={operations} />
          )}

          {/* Loading overlay */}
          <LoadingOverlay
            loading={viewState.loading}
            fetching={sourceState.fetching}
          />

          {/* Data content area */}
          <div
            id={gridTableId}
            className="wcdv-grid-table flex-1 min-h-0 overflow-auto relative"
            role="grid"
            aria-busy={viewState.loading}
          >
            <SortContext.Provider value={sortContextValue}>
            <FilterContext.Provider value={filterContextValue}>
            <ColumnConfigContext.Provider value={columnConfigContextValue}>
              {renderedChildren}
            </ColumnConfigContext.Provider>
            </FilterContext.Provider>
            </SortContext.Provider>
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
        <PerspectiveManagerDialog
          open={perspectiveOpen}
          onOpenChange={setPerspectiveOpen}
          currentPerspective={prefs.getCurrentPerspective() as PerspectiveInfo | undefined}
          perspectives={prefs.getPerspectives() as PerspectiveInfo[]}
          onSwitch={(id) => prefs.setCurrentPerspective(id)}
          onCreate={(name) => prefs.addPerspective(name)}
          onRename={(id, name) => prefs.renamePerspective(id, name)}
          onDelete={(id) => prefs.deletePerspective(id)}
        />
      )}
    </div>
    </LocaleProvider>
  );
}
