/**
 * HeaderContextMenu — Right-click context menu for table column headers.
 *
 * Replaces the legacy jquery-contextmenu with a pure React dropdown
 * positioned at the cursor via a portal.
 *
 * Supports nested submenus (one level) and checked items.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContextMenuItem } from './types';
import { useTranslation } from 'react-i18next';
import { ChevronGlyphIcon, DisclosureButton, MenuAction } from '../ui';

export interface HeaderContextMenuProps {
  /** Whether the menu is visible */
  open: boolean;
  /** Screen position */
  position: { x: number; y: number };
  /** Menu items */
  items: ContextMenuItem[];
  /** Close callback */
  onClose: () => void;
}

export function HeaderContextMenu({
  open,
  position,
  items,
  onClose,
}: HeaderContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  // Reset submenu when menu opens/closes
  useEffect(() => { if (!open) setOpenSub(null); }, [open]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Keep menu within viewport
  const getAdjustedPosition = useCallback(() => {
    const menuWidth = 200;
    const menuHeight = items.length * 36;
    const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
    const y = Math.min(position.y, window.innerHeight - menuHeight - 8);
    return { x: Math.max(8, x), y: Math.max(8, y) };
  }, [position, items.length]);

  if (!open) return null;

  const adjusted = getAdjustedPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 shadow-lg"
      style={{ left: adjusted.x, top: adjusted.y }}
      role="menu"
      aria-label={t('TABLE.COLUMN_OPTIONS') || 'Column options'}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              className="my-1 h-px bg-gray-200 dark:bg-neutral-700"
              role="separator"
            />
          );
        }

        // ── Item with submenu ──
        if (item.children && item.children.length > 0) {
          const subOpen = openSub === item.label;
          return (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenSub(item.label)}
              onMouseLeave={() => setOpenSub(null)}
            >
              <DisclosureButton
                className="rounded-none px-3 py-1.5 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={subOpen}
                onClick={() => setOpenSub(subOpen ? null : item.label)}
                indicator={item.icon ? <span className="w-4 text-center">{item.icon}</span> : undefined}
              >
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronGlyphIcon className="h-3.5 w-3.5 text-gray-400 dark:text-neutral-500" direction="right" />
              </DisclosureButton>
              {subOpen && (
                <div
                  className="absolute left-full top-0 z-50 min-w-[180px] rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-1 shadow-lg"
                  role="menu"
                  aria-label={item.label}
                >
                  {item.children.map((child) => {
                    if (child.separator) {
                      return <div key={`sub-sep-${child.label}`} className="my-1 h-px bg-gray-200 dark:bg-neutral-700" role="separator" />;
                    }
                    return (
                      <MenuAction
                        key={child.label}
                        className="rounded-none px-3 py-1.5 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-neutral-600"
                        role="menuitemradio"
                        checked={child.checked ?? false}
                        icon={child.icon as never}
                        shortcut={child.shortcut}
                        aria-checked={child.checked ?? false}
                        disabled={child.disabled}
                        onClick={() => {
                          child.onClick?.();
                          onClose();
                        }}
                      >
                        {child.label}
                      </MenuAction>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        // ── Plain item ──
        return (
          <MenuAction
            key={item.label}
            className="rounded-none px-3 py-1.5 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-neutral-600"
            role="menuitem"
            icon={item.icon as never}
            shortcut={item.shortcut}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            {item.label}
          </MenuAction>
        );
      })}
    </div>
  );
}
