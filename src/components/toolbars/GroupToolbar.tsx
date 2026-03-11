/**
 * GroupToolbar — Toolbar section for grouped data mode.
 *
 * Controls: Group mode (summary/detail), Show Total Row, Expand All,
 * Pin Groups, Columns, Templates.
 */

import { useState, useCallback } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Switch } from '@mieweb/ui/components/Switch';
import { Radio, RadioGroup } from '@mieweb/ui/components/Radio';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation, type TransFn } from '../../i18n';
import type { GridTableDef } from '../DataGrid';
import type { ViewInstance } from '../../adapters/use-data';

export interface GroupToolbarProps {
  tableDef?: GridTableDef;
  view: ViewInstance;
  trans?: TransFn;
  onRedraw: () => void;
  onOpenColumnConfig?: () => void;
  onOpenTemplateEditor?: () => void;
}

export function GroupToolbar({
  tableDef,
  view: _view,
  trans: transProp,
  onRedraw,
  onOpenColumnConfig,
  onOpenTemplateEditor,
}: GroupToolbarProps) {
  const t = useTranslation(transProp);
  const [groupMode, setGroupMode] = useState<'summary' | 'detail'>(
    tableDef?.groupMode ?? 'detail',
  );
  const [showTotalRow, setShowTotalRow] = useState(
    tableDef?.whenGroup?.showTotalRow ?? true,
  );
  const [expandAll, setExpandAll] = useState(
    tableDef?.whenGroup?.showExpandedGroups ?? false,
  );
  const [pinGroups, setPinGroups] = useState(
    tableDef?.whenGroup?.pinRowvals ?? false,
  );

  const isSummary = groupMode === 'summary';

  const handleGroupModeChange = useCallback(
    (mode: 'summary' | 'detail') => {
      setGroupMode(mode);
      if (tableDef) {
        tableDef.groupMode = mode;
      }
      onRedraw();
    },
    [tableDef, onRedraw],
  );

  const handleShowTotalRow = useCallback(
    (checked: boolean) => {
      setShowTotalRow(checked);
      if (tableDef?.whenGroup) {
        tableDef.whenGroup.showTotalRow = checked;
      }
    },
    [tableDef],
  );

  const handleExpandAll = useCallback(
    (checked: boolean) => {
      setExpandAll(checked);
      if (tableDef?.whenGroup) {
        tableDef.whenGroup.showExpandedGroups = checked;
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

  return (
    <>
      {/* Group Mode */}
      <RadioGroup
        name="groupMode"
        label={t('GRID_TOOLBAR.GROUP.MODE') || 'Group Mode'}
        value={groupMode}
        onValueChange={(val) => handleGroupModeChange(val as 'summary' | 'detail')}
        orientation="horizontal"
        size="sm"
      >
        <Radio
          value="summary"
          label={t('GRID_TOOLBAR.GROUP.MODE.SUMMARY') || 'Summary'}
        />
        <Radio
          value="detail"
          label={t('GRID_TOOLBAR.GROUP.MODE.DETAIL') || 'Detail'}
        />
      </RadioGroup>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 mx-1" role="separator" />

      {/* Show Total Row — enabled in both modes */}
      <div className="wcdv-toolbar-item flex items-center gap-1.5">
        <Switch
          checked={showTotalRow}
          onCheckedChange={handleShowTotalRow}
          aria-label={t('GRID_TOOLBAR.GROUP.TOTAL_ROW')}
        />
        <label className="text-xs text-gray-600 select-none">
          {t('GRID_TOOLBAR.GROUP.TOTAL_ROW') || 'Total Row'}
        </label>
      </div>

      {/* Expand All — only in detail mode */}
      {!isSummary && (
        <div className="wcdv-toolbar-item flex items-center gap-1.5">
          <Switch
            checked={expandAll}
            onCheckedChange={handleExpandAll}
            aria-label={t('GRID_TOOLBAR.GROUP.EXPAND_ALL')}
          />
          <label className="text-xs text-gray-600 select-none">
            {t('GRID_TOOLBAR.GROUP.EXPAND_ALL') || 'Expand All'}
          </label>
        </div>
      )}

      {/* Pin Groups — enabled in summary mode */}
      {isSummary && (
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
      )}

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 mx-1" role="separator" />

      {/* Columns — only in detail mode */}
      {!isSummary && (
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
      )}

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
    </>
  );
}
