/**
 * TitleBarActions — Reusable cluster of grid action buttons.
 *
 * Shared between the full `TitleBar` and the minimal-mode menu. Contains the
 * download, copy, refresh, controls-toggle, and (optionally) collapse buttons.
 */

import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation } from 'react-i18next';

import { ChevronGlyphIcon, ClipboardIcon, DocumentIcon, RefreshGlyphIcon, SettingsIcon } from './ui';

export interface TitleBarActionsProps {
  collapsed: boolean;
  onToggle: () => void;
  onToggleControls: () => void;
  onRefresh: () => void;
  onOpenPerspective?: () => void;
  onExportCsv?: () => void;
  onCopyClipboard?: () => void;
  /** Whether to render the collapse/expand button. Defaults to true. */
  showCollapse?: boolean;
}

export function TitleBarActions({
  collapsed,
  onToggle,
  onToggleControls,
  onRefresh,
  onOpenPerspective,
  onExportCsv,
  onCopyClipboard,
  showCollapse = true,
}: TitleBarActionsProps) {
  const { t } = useTranslation();

  return (
    <div
      className="wcdv-titlebar-controls flex items-center gap-1"
      role="toolbar"
      aria-label={t('GRID.TITLEBAR.ACTIONS')}
    >
      {onExportCsv && (
        <Tooltip content={t('GRID.TITLEBAR.DOWNLOAD_CSV') || 'Download CSV'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onExportCsv}
            aria-label={t('GRID.TITLEBAR.DOWNLOAD_CSV')}
          >
            <DocumentIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {onCopyClipboard && (
        <Tooltip content={t('GRID.TITLEBAR.COPY_CLIPBOARD') || 'Copy to Clipboard'}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopyClipboard}
            aria-label={t('GRID.TITLEBAR.COPY_CLIPBOARD')}
          >
            <ClipboardIcon className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

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

      {showCollapse && (
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
      )}
    </div>
  );
}
