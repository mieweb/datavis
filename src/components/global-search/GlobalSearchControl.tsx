import { Input } from '@mieweb/ui/components/Input';
import { useTranslation } from 'react-i18next';
import { startTransition, useEffect, useRef, useState } from 'react';

import { useLocale } from '../../i18n';
import { IconButton } from '../ui/actions';
import { CloseGlyphIcon, SearchIcon } from '../ui/icons';
import { normalizeSearchQuery } from './search-utils';

export interface GlobalSearchControlProps {
  query: string;
  resultCount: number;
  onQueryChange: (query: string) => void;
  onClear: () => void;
}

export function GlobalSearchControl({
  query,
  resultCount,
  onQueryChange,
  onClear,
}: GlobalSearchControlProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [draftQuery, setDraftQuery] = useState(query);
  const submittedQueriesRef = useRef(new Set<string>());
  const normalizedDraftQuery = normalizeSearchQuery(draftQuery, locale);
  const pending = normalizedDraftQuery !== query;

  useEffect(() => {
    if (submittedQueriesRef.current.delete(query)) {
      return;
    }
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    if (!pending) {
      submittedQueriesRef.current.clear();
    }
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      submittedQueriesRef.current.add(normalizedDraftQuery);
      startTransition(() => onQueryChange(normalizedDraftQuery));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [normalizedDraftQuery, onQueryChange, pending]);

  const clear = () => {
    submittedQueriesRef.current.clear();
    setDraftQuery('');
    onClear();
  };

  return (
    <div className="wcdv-global-search flex min-w-0 items-center gap-1.5" role="search">
      <SearchIcon className="text-gray-500 dark:text-neutral-400" />
      <Input
        hideLabel
        label={t('GRID.OMNIFILTER.ARIA_LABEL')}
        aria-label={t('GRID.OMNIFILTER.ARIA_LABEL')}
        placeholder={t('GRID.OMNIFILTER.PLACEHOLDER')}
        value={draftQuery}
        onChange={(event) => setDraftQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            clear();
          }
        }}
        className="h-8 w-44 px-2 py-1 text-sm"
      />
      {draftQuery.length > 0 && (
        <IconButton
          type="button"
          aria-label={t('GRID.OMNIFILTER.CLEAR')}
          onClick={clear}
        >
          <CloseGlyphIcon />
        </IconButton>
      )}
      <span
        className="wcdv-global-search-count min-w-16 whitespace-nowrap text-xs text-gray-500 dark:text-neutral-400"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={pending}
        data-testid="global-search-count"
      >
        {new Intl.NumberFormat(locale).format(resultCount)} {t(resultCount === 1 ? 'TABLE.ROW' : 'TABLE.ROWS')}
      </span>
    </div>
  );
}