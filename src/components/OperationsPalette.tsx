/**
 * OperationsPalette — Inline toolbar of action buttons for row-level operations.
 *
 * Replaces `src/operations_palette.js`. Groups operations by category.
 */

import React, { useMemo, useCallback } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';
import { useTranslation, type TransFn } from '../i18n';

export interface Operation {
  /** Unique index (assigned automatically if not provided) */
  idx?: number;
  /** Display label */
  label?: string;
  /** Icon identifier (e.g. FA class name or emoji) */
  icon?: string;
  /** Category for grouping */
  category?: string;
  /** Callback invoked when the operation is triggered */
  callback: (ctx: OperationContext) => void;
}

export interface OperationContext {
  /** Currently selected rows */
  rows: unknown[];
  /** The button element (for positioning popovers, etc.) */
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export interface OperationsPaletteProps {
  /** Available operations */
  operations: Operation[];
  /** Currently selected rows — passed to operation callbacks */
  selectedRows?: unknown[];
  /** i18n function */
  trans?: TransFn;
}

export function OperationsPalette({
  operations,
  selectedRows = [],
  trans: transProp,
}: OperationsPaletteProps) {
  const t = useTranslation(transProp);
  // Group operations by category
  const groups = useMemo(() => {
    const map = new Map<string, Operation[]>();
    for (const op of operations) {
      const cat = op.category ?? '';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(op);
    }
    return map;
  }, [operations]);

  const handleClick = useCallback(
    (op: Operation) => {
      op.callback({ rows: selectedRows });
    },
    [selectedRows],
  );

  if (operations.length === 0) return null;

  return (
    <div
      className="wcdv-operations-palette border-b border-gray-100 px-3 py-1.5 bg-white"
      role="toolbar"
      aria-label={t('GRID_CONTROL.OPERATIONS.TITLE') || 'Operations'}
    >
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        <span className="text-xs font-medium text-gray-500 mr-1">
          {t('GRID_CONTROL.OPERATIONS.TITLE') || 'Operations'}
        </span>

        {[...groups.entries()].map(([category, ops], gi) => (
          <React.Fragment key={category || gi}>
            {/* Category separator (except first) */}
            {gi > 0 && (
              <div className="w-px h-5 bg-gray-200 mx-0.5" role="separator" />
            )}

            {ops.map((op, i) => {
              const label = op.label ?? '';
              const tooltipText = label || op.icon || `Operation ${i}`;

              return (
                <Tooltip key={i} content={tooltipText}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClick(op)}
                    aria-label={tooltipText}
                  >
                    {op.icon && <span className="mr-0.5">{op.icon}</span>}
                    {label && <span>{label}</span>}
                  </Button>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
