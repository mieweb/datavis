/**
 * useColumnResize — Hook for CSS-based column resize via mouse drag.
 *
 * Replaces the legacy `_addColumnResizeHandle()` jQuery implementation
 * with a React-friendly mousedown/mousemove/mouseup pattern.
 */

import { useCallback, useRef } from 'react';

interface ResizeState {
  field: string;
  startX: number;
  startWidth: number;
}

const MIN_COLUMN_WIDTH = 50;

export function useColumnResize(
  onResize?: (field: string, width: number) => void,
) {
  const resizeRef = useRef<ResizeState | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = useCallback(
    (field: string, startWidth: number, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      resizeRef.current = {
        field,
        startX: event.clientX,
        startWidth: startWidth || MIN_COLUMN_WIDTH,
      };

      // Create resize indicator
      const indicator = document.createElement('div');
      indicator.className =
        'fixed top-0 bottom-0 w-px border-l-2 border-dashed border-blue-400 z-50 pointer-events-none';
      indicator.style.left = `${event.clientX}px`;
      document.body.appendChild(indicator);
      indicatorRef.current = indicator;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizeRef.current || !indicatorRef.current) return;
        indicatorRef.current.style.left = `${e.clientX}px`;
      };

      const handleMouseUp = (e: MouseEvent) => {
        if (resizeRef.current) {
          const delta = e.clientX - resizeRef.current.startX;
          const newWidth = Math.max(
            MIN_COLUMN_WIDTH,
            resizeRef.current.startWidth + delta,
          );
          onResize?.(resizeRef.current.field, newWidth);
        }

        // Cleanup
        resizeRef.current = null;
        if (indicatorRef.current) {
          indicatorRef.current.remove();
          indicatorRef.current = null;
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize],
  );

  return { handleResizeMouseDown: handleMouseDown };
}
