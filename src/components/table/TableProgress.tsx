/**
 * TableProgress — Progress bar for data loading in the table.
 *
 * Replaces the legacy jQuery UI `progressbar()` with @mieweb/ui Progress.
 * Shown at the top of the table during incremental data loading.
 */

import { Progress } from '@mieweb/ui/components/Progress';

export interface TableProgressProps {
  /** Current number of loaded rows */
  loaded: number;
  /** Total number of rows expected */
  total: number;
  /** Whether loading is in progress */
  active: boolean;
  /** i18n function */
  trans?: (key: string, ...args: unknown[]) => string;
}

export function TableProgress({
  loaded,
  total,
  active,
  trans: t = defaultTrans,
}: TableProgressProps) {
  if (!active || total <= 0) return null;

  const percent = Math.min(100, Math.round((loaded / total) * 100));

  return (
    <div
      className="wcdv-table-progress flex items-center gap-2 px-3 py-1 bg-blue-50 border-b border-blue-100"
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

function defaultTrans(key: string): string {
  return key;
}
