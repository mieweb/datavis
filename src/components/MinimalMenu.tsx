/**
 * MinimalMenu — Floating ellipsis button + menu for the grid's minimal mode.
 *
 * Replaces the full TitleBar. A partially-transparent ellipsis button overlays
 * the grid (fully opaque on hover). Clicking it opens a menu containing the
 * title bar actions (download, copy, refresh, show controls) on one row, the
 * perspective dropdown on a second row, and the perspective buttons beneath.
 */

import { useState } from 'react';
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
  /**
   * When `true` (default) the menu floats over the grid as a semi-transparent
   * overlay. When `false` it renders inline (e.g. inside the title bar) with a
   * plain ghost trigger.
   */
  floating?: boolean;
  /**
   * Whether to include the collapse/expand item. Omitted in the floating
   * (minimal) overlay since nothing would remain to expand; enabled when the
   * menu lives inside a visible title bar (default mode).
   */
  showCollapse?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function MinimalMenu({
  prefs,
  onToggleControls,
  onRefresh,
  onOpenPerspective,
  onExportCsv,
  onCopyClipboard,
  floating = true,
  showCollapse = false,
  collapsed = false,
  onToggle = () => {},
}: MinimalMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Selecting any menu action closes the menu. Afterwards its contents are
  // either redundant (toggling the controls surfaces the same buttons inline in
  // the title bar) or the action moved focus elsewhere (dialog, download), so a
  // lingering-open menu is never what the user wants.
  function closeThen(fn: () => void): () => void;
  function closeThen(fn: (() => void) | undefined): (() => void) | undefined;
  function closeThen(fn?: () => void) {
    return fn
      ? () => {
          setOpen(false);
          fn();
        }
      : undefined;
  }

  const wrapperClassName = floating
    ? 'wcdv-minimal-menu absolute right-3 top-11 z-20'
    : 'wcdv-minimal-menu -mr-2';
  const triggerClassName = floating
    ? 'border border-gray-300 bg-white/90 opacity-60 shadow-sm transition-opacity hover:opacity-100 dark:border-neutral-600 dark:bg-neutral-800/90'
    : 'h-5 w-5 p-0';
  const iconClassName = floating ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <div className={wrapperClassName}>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        trigger={(
          <Button
            size="sm"
            variant="ghost"
            className={triggerClassName}
            aria-label={t('GRID.TITLEBAR.ACTIONS') || 'Grid actions'}
            aria-haspopup="menu"
          >
            <Menu className={iconClassName} aria-hidden="true" />
          </Button>
        )}
      >
        <DropdownContent className="flex flex-col gap-2 p-2">
          {/* Row 1 — title bar actions (collapse optional, e.g. shown in
              default mode where a title bar remains visible) */}
          <TitleBarActions
            collapsed={collapsed}
            onToggle={closeThen(onToggle)}
            showCollapse={showCollapse}
            onToggleControls={closeThen(onToggleControls)}
            onRefresh={closeThen(onRefresh)}
            onOpenPerspective={closeThen(onOpenPerspective)}
            onExportCsv={closeThen(onExportCsv)}
            onCopyClipboard={closeThen(onCopyClipboard)}
          />

          {/* Rows 2 & 3 — perspective dropdown + perspective buttons */}
          {prefs && (
            <PrefsToolbar prefs={prefs} onOpenPerspective={closeThen(onOpenPerspective)} layout="stacked" />
          )}
        </DropdownContent>
      </Dropdown>
    </div>
  );
}
