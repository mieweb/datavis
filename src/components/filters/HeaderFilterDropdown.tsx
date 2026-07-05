/**
 * HeaderFilterDropdown — funnel icon in a column header that opens an
 * in-place filter popup, so users can filter without opening the controls
 * panel. String columns get a searchable value-checklist ($in) dropdown;
 * number, date, and boolean columns get their regular filter widget.
 * A gear button opens the full filter configuration (controls panel).
 * Changes are pushed into the shared filter spec via FilterContext,
 * keeping the filter bar in sync.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dropdown, DropdownContent, DropdownItem } from '@mieweb/ui/components/Dropdown';
import { useTranslation } from 'react-i18next';
import { IconButton, SettingsIcon } from '../ui';
import { useFilterContext } from './FilterContext';
import { FilterWidget } from './FilterBar';

export interface HeaderFilterDropdownProps {
  /** Field name to filter on */
  field: string;
  /** Column display name (for aria labels) */
  header: string;
  /** Whether a filter widget/spec is active for this field */
  filterActive?: boolean;
  /** The funnel trigger button content */
  children: React.ReactNode;
}

export function HeaderFilterDropdown({
  field,
  header,
  filterActive,
  children,
}: HeaderFilterDropdownProps) {
  const { t } = useTranslation();
  const filterCtx = useFilterContext();
  const [open, setOpen] = useState(false);
  // The popup is rendered in a body portal (fixed position) so it can't be
  // clipped by the table's overflow scroll container; anchor at the funnel.
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [anchorPos, setAnchorPos] = useState<{ top: number; left: number } | null>(null);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (rect) {
          setAnchorPos({
            top: rect.bottom + 2,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
          });
        }
      }
      return !prev;
    });
  }, []);

  // Nested widgets (e.g. the operator Select) render their popups in a
  // portal, so the Dropdown's outside-click detection would close this
  // popup when interacting with them. Track the last pointer-down target
  // and ignore close requests that originate inside a portaled popup or
  // on the funnel trigger itself (whose click handler does the toggling).
  const lastPointerTarget = useRef<EventTarget | null>(null);
  useEffect(() => {
    if (!open) return;
    const remember = (e: Event) => {
      lastPointerTarget.current = e.target;
    };
    document.addEventListener('mousedown', remember, true);
    document.addEventListener('touchstart', remember, true);
    return () => {
      document.removeEventListener('mousedown', remember, true);
      document.removeEventListener('touchstart', remember, true);
    };
  }, [open]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      const target = lastPointerTarget.current;
      lastPointerTarget.current = null;
      if (target instanceof Element) {
        if (target.closest('[role="listbox"], [role="dialog"]')) {
          return; // click was inside a nested (portaled) popup — stay open
        }
        if (anchorRef.current?.contains(target)) {
          return; // click on the funnel — its own handler toggles the state
        }
      }
    }
    setOpen(next);
  }, []);

  const fieldSpec = filterCtx?.filterSpec?.[field];
  const config = filterCtx?.getFilterConfig?.(field);
  // The $in value checklist only makes sense for text columns; other types
  // (number, date, boolean) get their regular filter widget in the popup.
  const isChecklist = !config || config.filterType === 'string';

  const selectedValues = useMemo(
    () => (Array.isArray(fieldSpec?.$in) ? fieldSpec.$in.map(String) : []),
    [fieldSpec],
  );

  // Only derive options while open to keep header rendering cheap
  const options = useMemo(
    () => (open && isChecklist ? filterCtx?.getFilterOptions?.(field) ?? [] : []),
    [open, isChecklist, filterCtx, field],
  );

  if (!filterCtx?.setFieldFilter) return null;

  const trigger = (
    <button
      ref={anchorRef}
      type="button"
      className="wcdv-header-filter-trigger inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        toggleOpen();
      }}
      aria-expanded={open}
      aria-label={
        filterActive
          ? (t('TABLE.FILTER_ACTIVE_ON', { param0: header }) || `Filter active on ${header}`)
          : (t('TABLE.ADD_FILTER_FOR', { param0: header }) || `Add filter for ${header}`)
      }
      title={filterActive ? (t('TABLE.FILTER_ACTIVE') || 'Filter active') : (t('TABLE.ADD_FILTER') || 'Add filter')}
    >
      {children}
    </button>
  );

  /** Header row inside the popup: column name + gear to the full filter config */
  const gearRow = filterCtx.openFilterControls && (
    <div className="wcdv-header-filter-toolbar flex items-center justify-between gap-2 border-b border-gray-200 dark:border-neutral-700 px-2 pb-1 mb-1">
      <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
        {header}
      </span>
      <IconButton
        type="button"
        variant="ghost"
        className="h-5 w-5 shrink-0 p-0"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(false);
          filterCtx.openFilterControls?.(field);
        }}
        aria-label={t('FILTER.OPEN_FULL_CONFIG', { param0: header }) || `Open full filter options for ${header}`}
        title={t('FILTER.OPEN_FULL_CONFIG_SHORT') || 'All filter options'}
      >
        <SettingsIcon className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );

  const popup = isChecklist ? (
    <Dropdown
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottom-start"
      searchable
      multiSelect
      showSelectAll
      selectedValues={selectedValues}
      onSelectedValuesChange={(values: string[]) => {
        filterCtx.setFieldFilter?.(field, values.length ? { $in: values } : null);
      }}
      searchPlaceholder={t('FILTER.SEARCH') || 'Search…'}
      searchAriaLabel={t('FILTER.SEARCH_OPTIONS') || 'Search options'}
      searchEmptyState={(
        <div className="px-3 py-2 text-xs italic text-gray-400">
          {t('FILTER.NO_RESULTS') || 'No results'}
        </div>
      )}
      selectAllLabel={t('FILTER.SELECT_ALL') || 'Select all'}
      trigger={<span aria-hidden="true" />}
    >
      <DropdownContent className="max-h-56 min-w-44 overflow-auto py-1">
        {gearRow}
        {options.map((option) => (
          <DropdownItem key={option} value={option} searchText={option}>
            {option || `(${t('FILTER.EMPTY') || 'empty'})`}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  ) : (
    <Dropdown open={open} onOpenChange={handleOpenChange} placement="bottom-start" trigger={<span aria-hidden="true" />}>
      <DropdownContent className="wcdv-header-filter-widget min-w-64 px-2 py-2">
        {gearRow}
        {config && (
          <FilterWidget
            column={config}
            value={fieldSpec}
            onChange={(f, spec) => filterCtx.setFieldFilter?.(f, spec)}
          />
        )}
      </DropdownContent>
    </Dropdown>
  );

  return (
    <>
      {trigger}
      {/* Body portal keeps the popup clear of the table's overflow clipping */}
      {open && anchorPos &&
        createPortal(
          <div
            className="wcdv-header-filter-portal fixed z-50"
            style={{ top: anchorPos.top, left: anchorPos.left }}
          >
            {popup}
          </div>,
          document.body,
        )}
    </>
  );
}
