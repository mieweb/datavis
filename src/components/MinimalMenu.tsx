/**
 * MinimalMenu — Floating ellipsis button + menu for the grid's minimal mode.
 *
 * Replaces the full TitleBar. A partially-transparent ellipsis button overlays
 * the grid (fully opaque on hover). Clicking it opens a menu containing the
 * title bar actions (download, copy, refresh, show controls) on one row, the
 * perspective dropdown on a second row, and the perspective buttons beneath.
 */

import { Button } from '@mieweb/ui/components/Button';
import { Dropdown, DropdownContent } from '@mieweb/ui/components/Dropdown';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TitleBarActions } from './TitleBarActions';
import { PrefsToolbar } from './toolbars/PrefsToolbar';
import type { PrefsInstance } from '../adapters/use-prefs';

export interface MinimalMenuProps {
  prefs?: PrefsInstance;
  onToggleControls: () => void;
  onRefresh: () => void;
  onOpenPerspective?: () => void;
  onExportCsv?: () => void;
  onCopyClipboard?: () => void;
}

export function MinimalMenu({
  prefs,
  onToggleControls,
  onRefresh,
  onOpenPerspective,
  onExportCsv,
  onCopyClipboard,
}: MinimalMenuProps) {
  const { t } = useTranslation();

  return (
    <div className="wcdv-minimal-menu absolute right-3 top-11 z-20">
      <Dropdown
        placement="bottom-end"
        trigger={(
          <Button
            size="sm"
            variant="ghost"
            className="border border-gray-300 bg-white/90 opacity-60 shadow-sm transition-opacity hover:opacity-100 dark:border-neutral-600 dark:bg-neutral-800/90"
            aria-label={t('GRID.TITLEBAR.ACTIONS') || 'Grid actions'}
            aria-haspopup="menu"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      >
        <DropdownContent className="flex flex-col gap-2 p-2">
          {/* Row 1 — title bar actions (no collapse button in minimal mode) */}
          <TitleBarActions
            collapsed={false}
            onToggle={() => {}}
            showCollapse={false}
            onToggleControls={onToggleControls}
            onRefresh={onRefresh}
            onOpenPerspective={onOpenPerspective}
            onExportCsv={onExportCsv}
            onCopyClipboard={onCopyClipboard}
          />

          {/* Rows 2 & 3 — perspective dropdown + perspective buttons */}
          {prefs && (
            <PrefsToolbar prefs={prefs} onOpenPerspective={onOpenPerspective} layout="stacked" />
          )}
        </DropdownContent>
      </Dropdown>
    </div>
  );
}
