/**
 * SortIndicator — shared column-header sort affordance.
 *
 * Renders the sort-direction glyph and, when more than one column is sorted,
 * a small priority badge (1, 2, 3…) so users can see the multi-column sort
 * order. Used by every table renderer to keep the indicator consistent.
 */

import { useTranslation } from 'react-i18next';

import type { SortDirection } from './types';
import { SortGlyphIcon } from '../ui';

export interface SortIndicatorProps {
  /** Active sort direction for this column, or undefined when unsorted */
  direction?: SortDirection;
  /** Zero-based priority index within the multi-column sort (0 = primary) */
  index?: number;
  /** Total number of active sort columns */
  count?: number;
}

export function SortIndicator({ direction, index, count = 0 }: SortIndicatorProps) {
  const { t } = useTranslation();

  if (!direction) {
    return (
      <span
        className="ml-1 inline-flex items-center text-gray-300 dark:text-neutral-600 text-xs"
        aria-hidden="true"
      >
        <SortGlyphIcon className="text-gray-300 dark:text-neutral-600" />
      </span>
    );
  }

  const showBadge = count > 1 && index != null;

  return (
    <span
      className="ml-1 inline-flex items-center gap-0.5 text-blue-500 dark:text-blue-400 text-xs"
      aria-label={
        direction === 'asc'
          ? (t('TABLE.SORTED_ASC') || 'Sorted ascending')
          : (t('TABLE.SORTED_DESC') || 'Sorted descending')
      }
    >
      <SortGlyphIcon className="text-blue-500 dark:text-blue-400" direction={direction} />
      {showBadge && (
        <span
          className="wcdv-sort-priority inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-blue-500 px-0.5 text-[0.625rem] font-semibold leading-none text-white dark:bg-blue-400 dark:text-neutral-900"
          aria-label={t('TABLE.SORT_LEVEL', { param0: index! + 1 }) || `Sort level ${index! + 1}`}
        >
          {index! + 1}
        </span>
      )}
    </span>
  );
}
