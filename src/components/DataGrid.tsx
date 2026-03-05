/**
 * DataGrid — Top-level React component replacing the jQuery Grid class.
 *
 * Composes: TitleBar, Toolbar, ControlPanel placeholder, OperationsPalette,
 * loading overlay, and content area.
 */

import { useState, useCallback, useMemo } from 'react';

import { useView, useSource, type ViewInstance } from '../adapters/use-data';
import { type PrefsInstance } from '../adapters/use-prefs';
import { TitleBar } from './TitleBar';
import { GridToolbar } from './GridToolbar';
import { ControlPanel } from './controls/ControlPanel';
import { type ControlFieldItem } from './controls/ControlSection';
import { type AggregateEntry, type AggregateFunction } from './controls/AggregateSection';
import { type ColumnFilterConfig, type FilterSpec } from './filters/types';
import { FilterContext, columnToFilterConfig, type FilterContextValue } from './filters/FilterContext';
import type { TableColumn } from './table/types';
import { OperationsPalette, type Operation } from './OperationsPalette';
import { DetailSlider } from './DetailSlider';
import { LoadingOverlay } from './LoadingOverlay';
import { ColumnConfigDialog, type ColumnConfig } from './dialogs/ColumnConfigDialog';
import { TemplateEditorDialog, type TemplateData } from './dialogs/TemplateEditorDialog';
import { DebugDialog } from './dialogs/DebugDialog';
import { GridTableOptionsDialog, type DisplayFormatConfig } from './dialogs/GridTableOptionsDialog';
import { GroupFunctionDialog } from './dialogs/GroupFunctionDialog';
import type { GroupFunction as GroupFunctionDef } from './dialogs/GroupFunctionDialog';
import { PerspectiveManagerDialog, type PerspectiveInfo } from './dialogs/PerspectiveManagerDialog';

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
  /** i18n function — defaults to identity */
  trans?: (key: string, ...args: unknown[]) => string;
  /** Enable debug button */
  debug?: boolean;
  /** Column filter configurations for the filter bar */
  filterColumns?: ColumnFilterConfig[];
  /** All table columns — used to derive filter configs when filter icon is clicked */
  allColumns?: TableColumn[];
  /** Available fields for group/pivot controls */
  controlFields?: { field: string; displayName: string; disabled?: boolean }[];
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
  trans: t = defaultTrans,
  debug = false,
  filterColumns = [],
  allColumns = [],
  controlFields = [],
  aggregateFields = [],
  aggregateFunctions = [],
  columnConfigs = [],
  onColumnConfigSave,
  templates = {},
  onTemplateSave,
  displayFormat,
  onDisplayFormatSave,
  groupFunctionDefs = [],
  onGroupFunctionSelect,
}: DataGridProps) {
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
    tableDef?.rowMode ?? 'wrapped',
  );

  // ── Control panel state ────────────────────────
  const [groupFields, setGroupFields] = useState<ControlFieldItem[]>([]);
  const [pivotFields, setPivotFields] = useState<ControlFieldItem[]>([]);
  const [aggregateEntries, setAggregateEntries] = useState<AggregateEntry[]>([]);

  // ── Dialog state ───────────────────────────────
  const [colConfigOpen, setColConfigOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [tableOptsOpen, setTableOptsOpen] = useState(false);
  const [groupFnOpen, setGroupFnOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [groupFnField, _setGroupFnField] = useState<string | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [groupFnCurrent, _setGroupFnCurrent] = useState<string | undefined>();
  const [perspectiveOpen, setPerspectiveOpen] = useState(false);

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

  const handleExport = useCallback(() => {
    // TODO: Implement CSV export — port grid.export()
  }, []);

  const handleRowModeChange = useCallback((mode: 'wrapped' | 'clipped') => {
    setRowMode(mode);
  }, []);

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
      setGroupFields(
        fields.map((f) => ({
          field: f,
          displayName: controlFields.find((cf) => cf.field === f)?.displayName ?? f,
        })),
      );
      if (fields.length === 0) {
        viewState.clearGroup();
      } else {
        viewState.setGroup({ fieldNames: fields });
      }
    },
    [controlFields, viewState],
  );

  const handlePivotChange = useCallback(
    (fields: string[]) => {
      setPivotFields(
        fields.map((f) => ({
          field: f,
          displayName: controlFields.find((cf) => cf.field === f)?.displayName ?? f,
        })),
      );
      if (fields.length === 0) {
        viewState.clearGroup(); // clear pivot by resetting group
      } else {
        viewState.setPivot({ fieldNames: fields });
      }
    },
    [controlFields, viewState],
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
        viewState.setAggregate(spec);
      }
    },
    [viewState],
  );

  // ── Dialog open helpers ────────────────────────
  const openColumnConfig = useCallback(() => setColConfigOpen(true), []);
  const openTemplateEditor = useCallback(() => setTemplateEditorOpen(true), []);
  const openDebug = useCallback(() => setDebugOpen(true), []);
  const openTableOpts = useCallback(() => setTableOptsOpen(true), []);
  const openPerspective = useCallback(() => setPerspectiveOpen(true), []);

  const handleColumnConfigSave = useCallback(
    (cols: ColumnConfig[], clearCache: string[]) => {
      onColumnConfigSave?.(cols, clearCache);
    },
    [onColumnConfigSave],
  );

  const handleTemplateSave = useCallback(
    (tpls: TemplateData) => {
      onTemplateSave?.(tpls);
    },
    [onTemplateSave],
  );

  const handleDisplayFormatSave = useCallback(
    (df: DisplayFormatConfig) => {
      onDisplayFormatSave?.(df);
    },
    [onDisplayFormatSave],
  );

  const handleGroupFnSelect = useCallback(
    (fnName: string | null) => {
      if (groupFnField) {
        onGroupFunctionSelect?.(groupFnField, fnName);
      }
    },
    [groupFnField, onGroupFunctionSelect],
  );

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
  return (
    <div
      className={`wcdv-grid flex flex-col border border-gray-200 rounded-lg bg-white shadow-sm ${className}`}
      style={height ? { height } : undefined}
      role="region"
      aria-label={title || t('GRID.TITLEBAR.TITLE')}
    >
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
        debug={debug}
        trans={t}
        prefs={prefs}
        onToggle={handleToggle}
        onToggleControls={handleToggleControls}
        onRefresh={handleRefresh}
        onExport={handleExport}
        onCancel={sourceState.cancel}
        onClearFilter={clearFilter}
        onOpenDebug={openDebug}
        onOpenPerspective={openPerspective}
      />

      {/* Collapsible Content */}
      {!collapsed && (
        <div className="wcdv-grid-content flex flex-col flex-1 min-h-0">
          {/* Toolbar (hidden with controls) */}
          {controlsVisible && showToolbar && (
            <GridToolbar
              dataMode={dataMode}
              tableDef={tableDef}
              rowMode={rowMode}
              view={view}
              trans={t}
              onRowModeChange={handleRowModeChange}
              onRedraw={() => view.getData()}
              onOpenColumnConfig={openColumnConfig}
              onOpenTemplateEditor={openTemplateEditor}
              onOpenTableOptions={openTableOpts}
            />
          )}

          {/* Control Panel */}
          {controlsVisible && (
            <ControlPanel
              filterColumns={mergedFilterColumns}
              allFilterableFields={allColumns.map((c) => ({ field: c.field, displayName: c.displayName ?? c.field }))}
              availableFields={controlFields}
              aggregateFields={aggregateFields}
              groupFields={groupFields}
              pivotFields={pivotFields}
              aggregateEntries={aggregateEntries}
              aggregateFunctions={aggregateFunctions}
              onFilterChange={handleFilterChange}
              onRemoveFilterColumn={removeFilterColumn}
              onAddFilterColumn={addFilterColumn}
              onGroupChange={handleGroupChange}
              onPivotChange={handlePivotChange}
              onAggregateChange={handleAggregateChange}
              trans={t}
            />
          )}

          {/* Operations Palette (hidden with controls) */}
          {controlsVisible && operations.length > 0 && (
            <OperationsPalette operations={operations} trans={t} />
          )}

          {/* Loading overlay */}
          <LoadingOverlay
            loading={viewState.loading}
            fetching={sourceState.fetching}
            trans={t}
          />

          {/* Data content area */}
          <div
            className="wcdv-grid-table flex-1 min-h-0 overflow-auto relative"
            role="grid"
            aria-busy={viewState.loading}
          >
            <FilterContext.Provider value={filterContextValue}>
              {children}
            </FilterContext.Provider>
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
        trans={t}
      />

      <TemplateEditorDialog
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        templates={templates}
        onSave={handleTemplateSave}
        trans={t}
      />

      <DebugDialog
        open={debugOpen}
        onOpenChange={setDebugOpen}
        source={{
          type: (sourceState.source as unknown as Record<string, unknown>).type as string | undefined,
          name: (sourceState.source as unknown as Record<string, unknown>).name as string | undefined,
          params: (sourceState as unknown as Record<string, unknown>).params,
        }}
        view={{
          name: (view as unknown as Record<string, unknown>).name as string | undefined,
          filter: viewState.data ? (viewState.data as unknown as Record<string, unknown>).filter : undefined,
          group: viewState.data?.isGroup ? viewState.data.groupFields : undefined,
          pivot: viewState.data?.isPivot ? viewState.data.pivotFields : undefined,
          aggregate: viewState.data ? (viewState.data as unknown as Record<string, unknown>).agg : undefined,
        }}
        grid={{ colConfig: columnConfigs }}
        prefs={prefs ? {
          autoSave: (prefs as unknown as Record<string, unknown>).autoSave as boolean | undefined,
          backendType: (prefs as unknown as Record<string, unknown>).backendType as string | undefined,
          currentPerspective: prefs.getCurrentPerspective()
            ? { id: prefs.getCurrentPerspective()!.id, name: prefs.getCurrentPerspective()!.name }
            : undefined,
          perspectives: prefs.getPerspectives().reduce(
            (acc, p) => ({ ...acc, [p.id]: { name: p.name, config: null } }),
            {},
          ),
        } : undefined}
        trans={t}
      />

      <GridTableOptionsDialog
        open={tableOptsOpen}
        onOpenChange={setTableOptsOpen}
        displayFormat={displayFormat}
        onSave={handleDisplayFormatSave}
        trans={t}
      />

      <GroupFunctionDialog
        open={groupFnOpen}
        onOpenChange={setGroupFnOpen}
        groupFunctions={groupFunctionDefs}
        currentFunction={groupFnCurrent}
        fieldName={groupFnField}
        onSelect={handleGroupFnSelect}
        trans={t}
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
          trans={t}
        />
      )}
    </div>
  );
}

function defaultTrans(key: string): string {
  return key;
}
