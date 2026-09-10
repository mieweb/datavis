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
import { PinnedPerspectivePills } from './toolbars/PinnedPerspectivePills';
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
  controlsVisible?: boolean;
  prefs?: PrefsInstance;
  /**
   * `'full'` (default) shows the row count and inline perspective/action
   * buttons. `'default'` shows a compact title, hides the row count, and
   * replaces the inline buttons with the hamburger menu.
   */
  variant?: 'full' | 'default';
  /** Custom actions rendered in the title bar, right-aligned before the
      built-in controls. Kept on one line on medium and wider screens. */
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
      className={`wcdv-title-bar flex flex-wrap items-center gap-2 px-3 md:flex-nowrap ${isDefault ? 'py-0.5' : 'py-2'} bg-muted border-b border-border rounded-t-lg`}
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
          className="wcdv-title-rowcount text-xs text-muted-foreground whitespace-nowrap"
          aria-live="polite"
        >
          {rowCountText} {t('TABLE.ROWS') || 'rows'}
        </span>
      )}

      {/* Status info */}
      <span className="wcdv-status-info flex items-center gap-2 text-xs text-muted-foreground ml-1">
        {!isDefault && rowCountText && (
          <span aria-live="polite">{rowCountText}</span>
        )}

        {hasActiveFilter && (
          <InlineActionButton
            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
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
            className="text-muted-foreground cursor-help"
            role="img"
            aria-label={t('GRID.TITLEBAR.HELP')}
          >
            <HelpIcon className="h-4 w-4" />
          </span>
        </Tooltip>
      )}

      <span className="wcdv-title-perspectives flex min-w-0 items-center overflow-x-auto">
        {prefs && <PinnedPerspectivePills prefs={prefs} />}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Custom consumer actions — stay on one line with the built-in controls */}
      {titleActions && (
        <span className="wcdv-title-actions flex items-center gap-1 whitespace-nowrap">
          {titleActions}
        </span>
      )}

      {isDefault ? (
        controlsVisible ? (
          <div className="flex items-center gap-2">
            {prefs && (
              <PrefsToolbar
                prefs={prefs}
                onOpenPerspective={onOpenPerspective}
                showPinnedPerspectives={false}
              />
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
        ) : (
          <MinimalMenu
            floating={false}
            prefs={prefs}
            showPinnedPerspectives={false}
            showCollapse
            collapsed={collapsed}
            onToggle={onToggle}
            onToggleControls={onToggleControls}
            onRefresh={onRefresh}
            onOpenPerspective={onOpenPerspective}
            onExportCsv={onExportCsv}
            onCopyClipboard={onCopyClipboard}
          />
        )
      ) : (
        <>
          {prefs && (
            <PrefsToolbar
              prefs={prefs}
              onOpenPerspective={onOpenPerspective}
              showPinnedPerspectives={false}
            />
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
        </>
      )}
    </div>
  );
}
