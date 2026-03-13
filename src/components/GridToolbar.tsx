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
  onOpenTemplateEditor?: () => void;
  onOpenTableOptions?: () => void;
}

export function GridToolbar({
  autoShowMore,
  dataMode,
  tableDef,
  rowMode,
  view,
  onAutoShowMoreChange,
  onRowModeChange,
  onRedraw,
  onShowAllRows,
  onOpenColumnConfig,
  onOpenTemplateEditor,
  onOpenTableOptions,
}: GridToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="wcdv-toolbar flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100 text-sm"
      role="toolbar"
      aria-label={t('GRID_TOOLBAR.LABEL') || 'Grid Toolbar'}
    >
      {dataMode === 'plain' && (
        <PlainToolbar
          autoShowMore={autoShowMore}
          tableDef={tableDef}
          rowMode={rowMode}
          onAutoShowMoreChange={onAutoShowMoreChange}
          onRowModeChange={onRowModeChange}
          onShowAllRows={onShowAllRows}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
        />
      )}

      {dataMode === 'group' && (
        <GroupToolbar
          tableDef={tableDef}
          view={view}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
        />
      )}

      {dataMode === 'pivot' && (
        <PivotToolbar
          tableDef={tableDef}
          view={view}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
          onOpenTableOptions={onOpenTableOptions}
        />
      )}
    </div>
  );
}
