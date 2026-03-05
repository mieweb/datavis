/**
 * GridToolbar — Composite toolbar that shows the appropriate section
 * based on data mode (plain / group / pivot).
 *
 * Replaces the jQuery toolbar sections from `src/ui/toolbars/grid.js`.
 */


import type { ViewInstance } from '../adapters/use-data';
import type { GridTableDef } from './DataGrid';
import { PlainToolbar } from './toolbars/PlainToolbar';
import { GroupToolbar } from './toolbars/GroupToolbar';
import { PivotToolbar } from './toolbars/PivotToolbar';

export interface GridToolbarProps {
  dataMode: 'plain' | 'group' | 'pivot';
  tableDef?: GridTableDef;
  rowMode: 'wrapped' | 'clipped';
  view: ViewInstance;
  trans: (key: string, ...args: unknown[]) => string;
  onRowModeChange: (mode: 'wrapped' | 'clipped') => void;
  onRedraw: () => void;
  onOpenColumnConfig?: () => void;
  onOpenTemplateEditor?: () => void;
  onOpenTableOptions?: () => void;
}

export function GridToolbar({
  dataMode,
  tableDef,
  rowMode,
  view,
  trans: t,
  onRowModeChange,
  onRedraw,
  onOpenColumnConfig,
  onOpenTemplateEditor,
  onOpenTableOptions,
}: GridToolbarProps) {
  return (
    <div
      className="wcdv-toolbar flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100 text-sm"
      role="toolbar"
      aria-label={t('GRID_TOOLBAR.LABEL') || 'Grid Toolbar'}
    >
      {dataMode === 'plain' && (
        <PlainToolbar
          tableDef={tableDef}
          rowMode={rowMode}
          trans={t}
          onRowModeChange={onRowModeChange}
          onShowAllRows={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
        />
      )}

      {dataMode === 'group' && (
        <GroupToolbar
          tableDef={tableDef}
          view={view}
          trans={t}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
        />
      )}

      {dataMode === 'pivot' && (
        <PivotToolbar
          tableDef={tableDef}
          view={view}
          trans={t}
          onRedraw={onRedraw}
          onOpenColumnConfig={onOpenColumnConfig}
          onOpenTemplateEditor={onOpenTemplateEditor}
          onOpenTableOptions={onOpenTableOptions}
        />
      )}
    </div>
  );
}
