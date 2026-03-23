/**
 * DetailSlider — Slide-in panel from the right edge for row detail.
 *
 * Replaces the jQuery `.wcdv-slider` component from `src/ui/slider.js`.
 * Uses CSS transform for the slide animation.
 */

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from './ui';

export interface DetailSliderProps {
  /** Whether the slider is open */
  open: boolean;
  /** Header text */
  header?: string;
  /** Close callback */
  onClose: () => void;
  /** Body content */
  children?: React.ReactNode;
}

export function DetailSlider({
  open,
  header = '',
  onClose,
  children,
}: DetailSliderProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Trap focus when open
  useEffect(() => {
    if (open && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      className={`
        wcdv-slider fixed top-0 right-0 h-full w-96 max-w-full
        bg-white shadow-lg border-l border-gray-200
        transform transition-transform duration-300 ease-in-out
        z-50 flex flex-col
        ${open ? 'translate-x-0' : 'translate-x-full'}
      `}
      role="dialog"
      aria-modal="true"
      aria-label={header || t('SLIDER.TITLE') || 'Detail panel'}
      aria-hidden={!open}
    >
      {/* Header */}
      <div className="wcdv-slider-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-sm font-semibold truncate">{header}</h2>
        <IconButton
          className="wcdv-slider-close text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label={t('SLIDER.CLOSE') || 'Close detail panel'}
        >
          ×
        </IconButton>
      </div>

      {/* Body */}
      <div className="wcdv-slider-body flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}
