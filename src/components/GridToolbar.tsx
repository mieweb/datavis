/**
 * GridToolbar — Composite toolbar that shows the appropriate section
 * based on data mode (plain / group / pivot).
 *
 * Replaces the jQuery toolbar sections from `src/ui/toolbars/grid.js`.
 */


import type { ViewInstance } from '../adapters/use-data';
import { useTranslation } from 'react-i18next';
import type { GridTableDef } from './DataGrid';
import { PlainToolbar } from './toolbars/PlainToolbar';
import { GroupToolbar } from './toolbars/GroupToolbar';
import { PivotToolbar } from './toolbars/PivotToolbar';
import { GlobalSearchControl } from './global-search/GlobalSearchControl';

export interface GridToolbarProps {
  autoShowMore: boolean;
  dataMode: 'plain' | 'group' | 'pivot';
  tableDef?: GridTableDef;
  rowMode: 'wrapped' | 'clipped';
  view: ViewInstance;
  onAutoShowMoreChange: (checked: boolean) => void;
  onRowModeChange: (mode: 'wrapped' | 'clipped') => void;
  onRedraw: () => void;
  onShowAllRows: () => void;
  onOpenColumnConfig?: () => void;
  onOpenTableOptions?: () => void;
  globalSearchQuery?: string;
  globalSearchResultCount?: number;
  onGlobalSearchChange?: (query: string) => void;
  onGlobalSearchClear?: () => void;
}

export function GridToolbar({
  autoShowMore: _autoShowMore,
  dataMode,
  tableDef,
  rowMode: _rowMode,
  view,
  onAutoShowMoreChange: _onAutoShowMoreChange,
  onRowModeChange: _onRowModeChange,
  onRedraw,
  onShowAllRows,
  onOpenColumnConfig,
  onOpenTableOptions,
  globalSearchQuery = '',
  globalSearchResultCount = 0,
  onGlobalSearchChange,
  onGlobalSearchClear,
}: GridToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="wcdv-toolbar flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-700 text-sm"
      role="toolbar"
      aria-label={t('GRID_TOOLBAR.LABEL') || 'Grid Toolbar'}
    >
      {dataMode === 'plain' && onGlobalSearchChange && onGlobalSearchClear && (
        <GlobalSearchControl
          query={globalSearchQuery}
          resultCount={globalSearchResultCount}
          onQueryChange={onGlobalSearchChange}
          onClear={onGlobalSearchClear}
        />
      )}

      {dataMode === 'plain' && (
        <PlainToolbar
          tableDef={tableDef}
          onShowAllRows={onShowAllRows}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTableOptions={onOpenTableOptions}
        />
      )}

      {dataMode === 'group' && (
        <GroupToolbar
          tableDef={tableDef}
          view={view}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
        />
      )}

      {dataMode === 'pivot' && (
        <PivotToolbar
          tableDef={tableDef}
          view={view}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTableOptions={onOpenTableOptions}
        />
      )}
    </div>
  );
}
