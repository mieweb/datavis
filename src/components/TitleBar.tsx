/**
 * TitleBar — Grid header with title, status info, and action buttons.
 *
 * Replaces the jQuery `.wcdv_grid_titlebar` DOM structure.
 */


import { Button } from '@mieweb/ui/components/Button';
import { Spinner } from '@mieweb/ui/components/Spinner';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import { ChevronGlyphIcon, HelpIcon, InlineActionButton, RefreshGlyphIcon, SettingsIcon } from './ui';
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
  prefs?: PrefsInstance;
  onToggle: () => void;
  onToggleControls: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onClearFilter: () => void;
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
  prefs,
  onToggle,
  onToggleControls,
  onRefresh,
  onCancel,
  onClearFilter,
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
      className="wcdv-title-bar flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 rounded-t-lg"
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
      <span className="wcdv-status-info flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 ml-1">
        {rowCountText && (
          <span aria-live="polite">{rowCountText}</span>
        )}

        {hasActiveFilter && (
          <InlineActionButton
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={onClearFilter}
            aria-label={t('GRID.TITLEBAR.CLEAR_FILTER')}
          >
            {t('GRID.TITLEBAR.CLEAR_FILTER') || 'Clear Filter'}
          </InlineActionButton>
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
            className="text-gray-400 dark:text-neutral-500 cursor-help"
            role="img"
            aria-label={t('GRID.TITLEBAR.HELP')}
          >
            <HelpIcon className="h-4 w-4" />
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
        <Tooltip content={t('GRID.TITLEBAR.REFRESH') || 'Refresh'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            aria-label={t('GRID.TITLEBAR.REFRESH')}
          >
            <RefreshGlyphIcon className="h-4 w-4" />
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
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </Tooltip>

        <Tooltip content={collapsed ? t('GRID.TITLEBAR.EXPAND') || 'Expand' : t('GRID.TITLEBAR.COLLAPSE') || 'Collapse'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            aria-label={collapsed ? t('GRID.TITLEBAR.EXPAND') : t('GRID.TITLEBAR.COLLAPSE')}
          >
            <ChevronGlyphIcon className="h-4 w-4" direction={collapsed ? 'right' : 'down'} />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
