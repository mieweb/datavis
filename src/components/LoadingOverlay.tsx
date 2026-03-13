/**
 * LoadingOverlay — Block-UI replacement using @mieweb/ui Spinner.
 *
 * Replaces `$.blockUI()` usage in the grid.
 */


import { Spinner } from '@mieweb/ui/components/Spinner';
import { useTranslation } from 'react-i18next';

export interface LoadingOverlayProps {
  /** Whether data processing (sort/filter/group) is happening */
  loading: boolean;
  /** Whether a network fetch is in progress */
  fetching: boolean;
}

export function LoadingOverlay({
  loading,
  fetching,
}: LoadingOverlayProps) {
  const { t } = useTranslation();
  if (!loading && !fetching) return null;

  return (
    <div
      className="wcdv-loading-overlay absolute inset-0 z-10 flex items-center justify-center bg-white/70"
      role="status"
      aria-live="polite"
      aria-label={
        fetching
          ? t('GRID.LOADING.FETCHING') || 'Fetching data…'
          : t('GRID.LOADING.PROCESSING') || 'Processing…'
      }
    >
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <span className="text-sm text-gray-500">
          {fetching
            ? t('GRID.LOADING.FETCHING') || 'Fetching data…'
            : t('GRID.LOADING.PROCESSING') || 'Processing…'}
        </span>
      </div>
    </div>
  );
}
