/**
 * HeaderContextMenu — Right-click context menu for table column headers.
 *
 * Replaces the legacy jquery-contextmenu with a pure React dropdown
 * positioned at the cursor via a portal.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ContextMenuItem } from './types';
import { useTranslation, type TransFn } from '../../i18n';

export interface HeaderContextMenuProps {
  /** Whether the menu is visible */
  open: boolean;
  /** Screen position */
  position: { x: number; y: number };
  /** Menu items */
  items: ContextMenuItem[];
  /** Close callback */
  onClose: () => void;
  /** i18n */
  trans?: TransFn;
}

export function HeaderContextMenu({
  open,
  position,
  items,
  onClose,
  trans: transProp,
}: HeaderContextMenuProps) {
  const t = useTranslation(transProp);
  const menuRef = useRef<HTMLDivElement>(null);

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
      className="fixed z-50 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: adjusted.x, top: adjusted.y }}
      role="menu"
      aria-label={t('TABLE.COLUMN_OPTIONS') || 'Column options'}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              className="my-1 h-px bg-gray-200"
              role="separator"
            />
          );
        }

        return (
          <button
            key={item.label}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && (
              <span className="w-4 text-center">{item.icon}</span>
            )}
            <span className="flex-1 text-left">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-gray-400">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
