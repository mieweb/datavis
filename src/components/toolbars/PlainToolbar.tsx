/**
 * PlainToolbar — Toolbar section for plain (ungrouped) data mode.
 *
 * Controls: Auto-show-more, Show All, Columns, Templates, Row Mode, Auto Resize.
 */

import { useState, useCallback } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Switch } from '@mieweb/ui/components/Switch';
import { Radio, RadioGroup } from '@mieweb/ui/components/Radio';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation, type TransFn } from '../../i18n';
import type { GridTableDef } from '../DataGrid';

export interface PlainToolbarProps {
  tableDef?: GridTableDef;
  rowMode: 'wrapped' | 'clipped';
  trans?: TransFn;
  onRowModeChange: (mode: 'wrapped' | 'clipped') => void;
  onShowAllRows?: () => void;
  onOpenColumnConfig?: () => void;
  onOpenTemplateEditor?: () => void;
  onAutoResizeColumns?: () => void;
}

export function PlainToolbar({
  tableDef,
  rowMode,
  trans: transProp,
  onRowModeChange,
  onShowAllRows,
  onOpenColumnConfig,
  onOpenTemplateEditor,
  onAutoResizeColumns,
}: PlainToolbarProps) {
  const t = useTranslation(transProp);
  const [autoShowMore, setAutoShowMore] = useState(
    tableDef?.limit?.autoShowMore ?? true,
  );

  const handleAutoShowMoreChange = useCallback(
    (checked: boolean) => {
      setAutoShowMore(checked);
      if (tableDef?.limit) {
        tableDef.limit.autoShowMore = checked;
      }
    },
    [tableDef],
  );

  const handleShowAllRows = useCallback(() => {
    onShowAllRows?.();
  }, [onShowAllRows]);

  return (
    <>
      {/* Auto Show More */}
      <div className="wcdv-toolbar-item flex items-center gap-1.5">
        <Switch
          checked={autoShowMore}
          onCheckedChange={handleAutoShowMoreChange}
          aria-label={t('GRID_TOOLBAR.PLAIN.SHOW_MORE_ON_SCROLL')}
        />
        <label className="text-xs text-gray-600 select-none cursor-pointer">
          {t('GRID_TOOLBAR.PLAIN.SHOW_MORE_ON_SCROLL') || 'Auto-show more'}
        </label>
      </div>

      {/* Show All Rows */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleShowAllRows}
        aria-label={t('GRID_TOOLBAR.PLAIN.SHOW_ALL_ROWS')}
      >
        {t('GRID_TOOLBAR.PLAIN.SHOW_ALL_ROWS') || 'Show All Rows'}
      </Button>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 mx-1" role="separator" />

      {/* Columns */}
      <Tooltip content={t('GRID_TOOLBAR.PLAIN.COLUMNS') || 'Columns'}>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenColumnConfig}
          aria-label={t('GRID_TOOLBAR.PLAIN.COLUMNS')}
        >
          ☰ {t('GRID_TOOLBAR.PLAIN.COLUMNS') || 'Columns'}
        </Button>
      </Tooltip>

      {/* Templates Editor */}
      <Tooltip content={t('GRID_TOOLBAR.PLAIN.TEMPLATES_EDITOR') || 'Templates'}>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenTemplateEditor}
          aria-label={t('GRID_TOOLBAR.PLAIN.TEMPLATES_EDITOR')}
        >
          ✏ {t('GRID_TOOLBAR.PLAIN.TEMPLATES_EDITOR') || 'Templates'}
        </Button>
      </Tooltip>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 mx-1" role="separator" />

      {/* Row Mode */}
      <RadioGroup
        name="rowMode"
        label={t('GRID_TOOLBAR.PLAIN.ROW_MODE') || 'Row Mode'}
        value={rowMode}
        onValueChange={(val) => onRowModeChange(val as 'wrapped' | 'clipped')}
        orientation="horizontal"
        size="sm"
      >
        <Radio
          value="wrapped"
          label={t('GRID_TOOLBAR.PLAIN.ROW_MODE.WRAPPED') || 'Wrapped'}
        />
        <Radio
          value="clipped"
          label={t('GRID_TOOLBAR.PLAIN.ROW_MODE.CLIPPED') || 'Clipped'}
        />
      </RadioGroup>

      {/* Auto Resize Columns */}
      <Tooltip content={t('GRID_TOOLBAR.PLAIN.AUTO_RESIZE_COLUMNS') || 'Auto Resize'}>
        <Button
          size="sm"
          variant="outline"
          onClick={onAutoResizeColumns}
          aria-label={t('GRID_TOOLBAR.PLAIN.AUTO_RESIZE_COLUMNS')}
        >
          ↔ {t('GRID_TOOLBAR.PLAIN.AUTO_RESIZE_COLUMNS') || 'Auto Resize'}
        </Button>
      </Tooltip>
    </>
  );
}
