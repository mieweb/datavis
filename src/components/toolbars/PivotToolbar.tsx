/**
 * PivotToolbar — Toolbar section for pivot data mode.
 *
 * Controls: Show Totals, Pin Groups, Hide Zero Values, Templates.
 */

import { useState, useCallback } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Switch } from '@mieweb/ui/components/Switch';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation, type TransFn } from '../../i18n';
import type { GridTableDef } from '../DataGrid';
import type { ViewInstance } from '../../adapters/use-data';

export interface PivotToolbarProps {
  tableDef?: GridTableDef;
  view: ViewInstance;
  trans?: TransFn;
  onRedraw: () => void;
  onOpenColumnConfig?: () => void;
  onOpenTemplateEditor?: () => void;
  onOpenTableOptions?: () => void;
}

export function PivotToolbar({
  tableDef,
  view: _view,
  trans: transProp,
  onRedraw,
  onOpenColumnConfig,
  onOpenTemplateEditor,
  onOpenTableOptions,
}: PivotToolbarProps) {
  const t = useTranslation(transProp);
  const [showTotals, setShowTotals] = useState(
    tableDef?.whenPivot?.showTotalCol ?? true,
  );
  const [pinGroups, setPinGroups] = useState(
    tableDef?.whenGroup?.pinRowvals ?? false,
  );
  const [hideZeroValues, setHideZeroValues] = useState(
    tableDef?.whenPivot?.hideBottomValueAggResults ?? false,
  );

  const handleShowTotals = useCallback(
    (checked: boolean) => {
      setShowTotals(checked);
      if (tableDef?.whenPivot) {
        tableDef.whenPivot.showTotalCol = checked;
      }
      onRedraw();
    },
    [tableDef, onRedraw],
  );

  const handlePinGroups = useCallback(
    (checked: boolean) => {
      setPinGroups(checked);
      if (tableDef?.whenGroup) {
        tableDef.whenGroup.pinRowvals = checked;
      }
      onRedraw();
    },
    [tableDef, onRedraw],
  );

  const handleHideZeroValues = useCallback(
    (checked: boolean) => {
      setHideZeroValues(checked);
      if (tableDef?.whenPivot) {
        tableDef.whenPivot.hideBottomValueAggResults = checked;
      }
      onRedraw();
    },
    [tableDef, onRedraw],
  );

  return (
    <>
      {/* Show Totals */}
      <div className="wcdv-toolbar-item flex items-center gap-1.5">
        <Switch
          checked={showTotals}
          onCheckedChange={handleShowTotals}
          aria-label={t('GRID_TOOLBAR.PIVOT.TOTAL_ROW_COLUMN')}
        />
        <label className="text-xs text-gray-600 select-none">
          {t('GRID_TOOLBAR.PIVOT.TOTAL_ROW_COLUMN') || 'Show Totals'}
        </label>
      </div>

      {/* Pin Groups */}
      <div className="wcdv-toolbar-item flex items-center gap-1.5">
        <Switch
          checked={pinGroups}
          onCheckedChange={handlePinGroups}
          aria-label={t('GRID_TOOLBAR.GROUP.PIN_GROUPS')}
        />
        <label className="text-xs text-gray-600 select-none">
          {t('GRID_TOOLBAR.GROUP.PIN_GROUPS') || 'Pin Groups'}
        </label>
      </div>

      {/* Hide Zero Values */}
      <div className="wcdv-toolbar-item flex items-center gap-1.5">
        <Switch
          checked={hideZeroValues}
          onCheckedChange={handleHideZeroValues}
          aria-label={t('GRID_TOOLBAR.PIVOT.HIDE_ZERO_VALUES')}
        />
        <label className="text-xs text-gray-600 select-none">
          {t('GRID_TOOLBAR.PIVOT.HIDE_ZERO_VALUES') || 'Hide Zero Values'}
        </label>
      </div>

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

      {/* Table Options */}
      <Tooltip content={t('GRID_TOOLBAR.PIVOT.TABLE_OPTIONS') || 'Table Options'}>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenTableOptions}
          aria-label={t('GRID_TOOLBAR.PIVOT.TABLE_OPTIONS')}
        >
          ⚙ {t('GRID_TOOLBAR.PIVOT.TABLE_OPTIONS') || 'Table Options'}
        </Button>
      </Tooltip>
    </>
  );
}
