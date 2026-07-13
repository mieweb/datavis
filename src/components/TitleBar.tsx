/**
 * TitleBar — Grid header with title, status info, and action buttons.
 *
 * Replaces the jQuery `.wcdv_grid_titlebar` DOM structure.
 */


import { Button } from '@mieweb/ui/components/Button';
import { Spinner } from '@mieweb/ui/components/Spinner';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
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
  /** Whether the controls panel is currently open. In `'default'` variant
      the action buttons embed inline in the header while it's open. */
  controlsVisible?: boolean;
  prefs?: PrefsInstance;
  /**
   * `'full'` (default) shows the row count and inline perspective/action
   * buttons. `'default'` shows a compact title, hides the row count, and
   * replaces the inline buttons with the hamburger menu.
   */
  variant?: 'full' | 'default';
  /** Custom actions rendered in the title bar, right-aligned before the
      built-in controls. Kept on one line alongside the inline toolbar or
      hamburger menu — the title bar never wraps. */
  titleActions?: ReactNode;
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
  controlsVisible = false,
  prefs,
  variant = 'full',
  titleActions,
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

      {/* Custom consumer actions — stay on one line with the built-in controls */}
      {titleActions && (
        <span className="wcdv-title-actions flex items-center gap-1 whitespace-nowrap">
          {titleActions}
        </span>
      )}

      {isDefault ? (
        /* Default mode — hamburger menu replaces the inline perspective and
           action buttons. While the controls are open the actions embed
           inline in the header, but only when the title bar is wide enough
           to fit them all (container query); otherwise the hamburger popup
           is used. */
        <>
          {controlsVisible && (
            <div className="wcdv-titlebar-inline items-center gap-2">
              {prefs && (
                <PrefsToolbar prefs={prefs} onOpenPerspective={onOpenPerspective} />
              )}
              <TitleBarActions
                collapsed={collapsed}
                onToggle={onToggle}
                onToggleControls={onToggleControls}
                onRefresh={onRefresh}
                onOpenPerspective={onOpenPerspective}
                onExportCsv={onExportCsv}
                onCopyClipboard={onCopyClipboard}
              />
            </div>
          )}
          <div className={controlsVisible ? 'wcdv-titlebar-burger' : undefined}>
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
          </div>
        </>
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
