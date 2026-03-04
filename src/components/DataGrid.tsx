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
import { OperationsPalette, type Operation } from './OperationsPalette';
import { DetailSlider } from './DetailSlider';
import { LoadingOverlay } from './LoadingOverlay';

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
  /** Available fields for group/pivot controls */
  controlFields?: { field: string; displayName: string; disabled?: boolean }[];
  /** Available fields for aggregate controls */
  aggregateFields?: { field: string; displayName: string }[];
  /** Available aggregate functions */
  aggregateFunctions?: AggregateFunction[];
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
  controlFields = [],
  aggregateFields = [],
  aggregateFunctions = [],
}: DataGridProps) {
  // ── Adapter hooks ──────────────────────────────
  const viewState = useView(view);
  const sourceState = useSource(view.source);

  // ── Local UI state ─────────────────────────────
  const [collapsed, setCollapsed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(initialShowControls);
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
      />

      {/* Collapsible Content */}
      {!collapsed && (
        <div className="wcdv-grid-content flex flex-col flex-1 min-h-0">
          {/* Toolbar */}
          {showToolbar && (
            <GridToolbar
              dataMode={dataMode}
              tableDef={tableDef}
              rowMode={rowMode}
              view={view}
              trans={t}
              onRowModeChange={handleRowModeChange}
              onRedraw={() => view.getData()}
            />
          )}

          {/* Control Panel */}
          {controlsVisible && (
            <ControlPanel
              filterColumns={filterColumns}
              availableFields={controlFields}
              aggregateFields={aggregateFields}
              groupFields={groupFields}
              pivotFields={pivotFields}
              aggregateEntries={aggregateEntries}
              aggregateFunctions={aggregateFunctions}
              onFilterChange={handleFilterChange}
              onGroupChange={handleGroupChange}
              onPivotChange={handlePivotChange}
              onAggregateChange={handleAggregateChange}
              trans={t}
            />
          )}

          {/* Operations Palette */}
          {operations.length > 0 && (
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
            {children}
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
    </div>
  );
}

function defaultTrans(key: string): string {
  return key;
}
