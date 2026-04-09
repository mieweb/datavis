/**
 * TableProgress — Progress bar for data loading in the table.
 *
 * Replaces the legacy jQuery UI `progressbar()` with @mieweb/ui Progress.
 * Shown at the top of the table during incremental data loading.
 */

import { Progress } from '@mieweb/ui/components/Progress';
import { useTranslation } from 'react-i18next';

export interface TableProgressProps {
  /** Current number of loaded rows */
  loaded: number;
  /** Total number of rows expected */
  total: number;
  /** Whether loading is in progress */
  active: boolean;
}

export function TableProgress({
  loaded,
  total,
  active,
}: TableProgressProps) {
  const { t } = useTranslation();
  if (!active || total <= 0) return null;

  const percent = Math.min(100, Math.round((loaded / total) * 100));

  return (
    <div
      className="wcdv-table-progress flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800"
      role="status"
      aria-label={`${t('TABLE.LOADING') || 'Loading'}: ${percent}%`}
    >
      <Progress value={percent} className="flex-1 h-1.5" />
      <span className="text-xs text-blue-600 whitespace-nowrap">
        {loaded} / {total} {t('TABLE.ROWS') || 'rows'} ({percent}%)
      </span>
    </div>
  );
}
