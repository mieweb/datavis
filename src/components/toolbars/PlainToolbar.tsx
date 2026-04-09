/**
 * PlainToolbar — Toolbar section for plain (ungrouped) data mode.
 *
 * Controls: Show All and Columns.
 */

import { useCallback } from 'react';
import { Button } from '@mieweb/ui/components/Button';
import { Tooltip } from '@mieweb/ui/components/Tooltip';

import { useTranslation } from 'react-i18next';
import type { GridTableDef } from '../DataGrid';
import { DocumentIcon } from '../ui';

export interface PlainToolbarProps {
  tableDef?: GridTableDef;
  onShowAllRows?: () => void;
  onOpenColumnConfig?: () => void;
}

export function PlainToolbar({
  tableDef: _tableDef,
  onShowAllRows,
  onOpenColumnConfig,
}: PlainToolbarProps) {
  const { t } = useTranslation();

  const handleShowAllRows = useCallback(() => {
    onShowAllRows?.();
  }, [onShowAllRows]);

  return (
    <>
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
      <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" role="separator" />

      {/* Columns */}
      <Tooltip content={t('GRID_TOOLBAR.PLAIN.COLUMNS') || 'Columns'}>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<DocumentIcon className="h-4 w-4" />}
          onClick={onOpenColumnConfig}
          aria-label={t('GRID_TOOLBAR.PLAIN.COLUMNS')}
        >
          {t('GRID_TOOLBAR.PLAIN.COLUMNS') || 'Columns'}
        </Button>
      </Tooltip>
    </>
  );
}
