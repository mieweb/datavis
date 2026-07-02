/**
 * TitleBar — Grid header with title, status info, and action buttons.
 *
 * Replaces the jQuery `.wcdv_grid_titlebar` DOM structure.
 */


import { Button } from '@mieweb/ui/components/Button';
import { Spinner } from '@mieweb/ui/components/Spinner';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import { HelpIcon, InlineActionButton } from './ui';
import { PrefsToolbar } from './toolbars/PrefsToolbar';
import { TitleBarActions } from './TitleBarActions';
import { MinimalMenu } from './MinimalMenu';
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
  /**
   * `'full'` (default) shows the row count and inline perspective/action
   * buttons. `'default'` shows a compact title, hides the row count, and
   * replaces the inline buttons with the hamburger menu.
   */
  variant?: 'full' | 'default';
  onToggle: () => void;
  onToggleControls: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  onClearFilter: () => void;
  onOpenPerspective?: () => void;
  onExportCsv?: () => void;
  onCopyClipboard?: () => void;
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
  variant = 'full',
  onToggle,
  onToggleControls,
  onRefresh,
  onCancel,
  onClearFilter,
  onOpenPerspective,
  onExportCsv,
  onCopyClipboard,
}: TitleBarProps) {
  const { t } = useTranslation();
  const isDefault = variant === 'default';
  const filtered = totalRowCount > 0 && rowCount !== totalRowCount;
  const rowCountText = filtered
    ? `${rowCount} / ${totalRowCount}`
    : rowCount > 0
      ? String(rowCount)
      : '';

  return (
    <div
      className={`wcdv-title-bar flex items-center gap-2 px-3 ${isDefault ? 'py-0.5' : 'py-2'} bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 rounded-t-lg`}
      role="group"
      aria-label={title}
    >
      {/* Spinner */}
      {loading && (
        <Spinner size="sm" aria-label={t('GRID.TITLEBAR.LOADING')} />
      )}

      {/* Title */}
      <strong
        className={`wcdv-title ${isDefault ? 'text-xs' : 'text-sm'} font-semibold truncate`}
        aria-live="polite"
      >
        {title}
      </strong>

      {/* Row count beside the title (default mode) */}
      {isDefault && rowCountText && (
        <span
          className="wcdv-title-rowcount text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap"
          aria-live="polite"
        >
          {rowCountText} {t('TABLE.ROWS') || 'rows'}
        </span>
      )}

      {/* Status info */}
      <span className="wcdv-status-info flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400 ml-1">
        {!isDefault && rowCountText && (
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

      {isDefault ? (
        /* Default mode — hamburger menu replaces the inline perspective and
           action buttons (collapse included since the title bar stays visible) */
        <MinimalMenu
          floating={false}
          prefs={prefs}
          showCollapse
          collapsed={collapsed}
          onToggle={onToggle}
          onToggleControls={onToggleControls}
          onRefresh={onRefresh}
          onOpenPerspective={onOpenPerspective}
          onExportCsv={onExportCsv}
          onCopyClipboard={onCopyClipboard}
        />
      ) : (
        <>
          {/* Prefs toolbar (perspective management) */}
          {prefs && (
            <PrefsToolbar prefs={prefs} onOpenPerspective={onOpenPerspective} />
          )}

          {/* Action buttons */}
          <TitleBarActions
            collapsed={collapsed}
            onToggle={onToggle}
            onToggleControls={onToggleControls}
            onRefresh={onRefresh}
            onOpenPerspective={onOpenPerspective}
            onExportCsv={onExportCsv}
            onCopyClipboard={onCopyClipboard}
          />
        </>
      )}
    </div>
  );
}
