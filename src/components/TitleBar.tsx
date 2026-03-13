/**
 * TitleBar — Grid header with title, status info, and action buttons.
 *
 * Replaces the jQuery `.wcdv_grid_titlebar` DOM structure.
 */


import { Button } from '@mieweb/ui/components/Button';
import { Spinner } from '@mieweb/ui/components/Spinner';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import { PrefsToolbar } from './toolbars/PrefsToolbar';
import type { PrefsInstance } from '../adapters/use-prefs';

export interface TitleBarProps {
  title: string;
  helpText?: string;
  loading: boolean;
  rowCount: number;
  totalRowCount: number;
  hasActiveFilter: boolean;
  cancellable: boolean;
  collapsed: boolean;
  debug: boolean;
  prefs?: PrefsInstance;
  onToggle: () => void;
  onToggleControls: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onCancel: () => void;
  onClearFilter: () => void;
  onOpenDebug?: () => void;
  onOpenPerspective?: () => void;
}

export function TitleBar({
  title,
  helpText,
  loading,
  rowCount,
  totalRowCount,
  hasActiveFilter,
  cancellable,
  collapsed,
  debug,
  prefs,
  onToggle,
  onToggleControls,
  onRefresh,
  onExport,
  onCancel,
  onClearFilter,
  onOpenDebug,
  onOpenPerspective,
}: TitleBarProps) {
  const { t } = useTranslation();
  const filtered = totalRowCount > 0 && rowCount !== totalRowCount;
  const rowCountText = filtered
    ? `${rowCount} / ${totalRowCount}`
    : rowCount > 0
      ? String(rowCount)
      : '';

  return (
    <div
      className="wcdv-title-bar flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg"
      role="banner"
    >
      {/* Spinner */}
      {loading && (
        <Spinner size="sm" aria-label={t('GRID.TITLEBAR.LOADING')} />
      )}

      {/* Title */}
      <strong className="wcdv-title text-sm font-semibold truncate" aria-live="polite">
        {title}
      </strong>

      {/* Status info */}
      <span className="wcdv-status-info flex items-center gap-2 text-xs text-gray-500 ml-1">
        {rowCountText && (
          <span aria-live="polite">{rowCountText}</span>
        )}

        {hasActiveFilter && (
          <button
            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
            onClick={onClearFilter}
            aria-label={t('GRID.TITLEBAR.CLEAR_FILTER')}
          >
            {t('GRID.TITLEBAR.CLEAR_FILTER') || 'Clear Filter'}
          </button>
        )}

        {cancellable && loading && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            aria-label={t('GRID.TITLEBAR.CANCEL')}
          >
            {t('GRID.TITLEBAR.CANCEL') || 'Cancel'}
          </Button>
        )}
      </span>

      {/* Help tooltip */}
      {helpText && (
        <Tooltip content={helpText}>
          <span
            className="text-gray-400 cursor-help"
            role="img"
            aria-label={t('GRID.TITLEBAR.HELP')}
          >
            &#9432;
          </span>
        </Tooltip>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Prefs toolbar (perspective management) */}
      {prefs && (
        <PrefsToolbar prefs={prefs} />
      )}

      {/* Action buttons */}
      <div className="wcdv-titlebar-controls flex items-center gap-1" role="toolbar" aria-label={t('GRID.TITLEBAR.ACTIONS')}>
        {debug && (
          <Tooltip content={t('GRID.TITLEBAR.DEBUG') || 'Debug'}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenDebug}
              aria-label={t('GRID.TITLEBAR.DEBUG')}
            >
              🐛
            </Button>
          </Tooltip>
        )}

        <Tooltip content={t('GRID.TITLEBAR.EXPORT') || 'Export'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onExport}
            aria-label={t('GRID.TITLEBAR.EXPORT')}
          >
            ⬇
          </Button>
        </Tooltip>

        <Tooltip content={t('GRID.TITLEBAR.REFRESH') || 'Refresh'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            aria-label={t('GRID.TITLEBAR.REFRESH')}
          >
            ↻
          </Button>
        </Tooltip>

        <Tooltip content={t('GRID.TITLEBAR.CONTROLS') || 'Controls'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleControls}
            onDoubleClick={onOpenPerspective}
            aria-label={t('GRID.TITLEBAR.CONTROLS')}
          >
            ⚙
          </Button>
        </Tooltip>

        <Tooltip content={collapsed ? t('GRID.TITLEBAR.EXPAND') || 'Expand' : t('GRID.TITLEBAR.COLLAPSE') || 'Collapse'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            aria-label={collapsed ? t('GRID.TITLEBAR.EXPAND') : t('GRID.TITLEBAR.COLLAPSE')}
          >
            {collapsed ? '▶' : '▼'}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
