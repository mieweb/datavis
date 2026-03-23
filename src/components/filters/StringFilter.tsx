/**
 * StringFilter — filter component for string-type columns.
 *
 * Renders either a text input (with operator dropdown) or a multi-select
 * dropdown (replacing SumoSelect) depending on the widget hint.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@mieweb/ui/components/Input';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Button } from '@mieweb/ui/components/Button';
import { useTranslation } from 'react-i18next';
import { InlineActionButton } from '../ui';
import { FilterOperatorSelect } from './FilterOperatorSelect';
import {
  STRING_OPERATORS,
  type FilterOperator,
  type FieldFilterSpec,
} from './types';

export interface StringFilterProps {
  /** Field name */
  field: string;
  /** Display label */
  label: string;
  /** Widget variant: 'textbox' | 'dropdown' */
  widget?: 'textbox' | 'dropdown';
  /** Available options for dropdown mode */
  options?: string[];
  /** Operators to include */
  includeOperators?: FilterOperator[];
  /** Operators to exclude */
  excludeOperators?: FilterOperator[];
  /** Current filter value */
  value?: FieldFilterSpec;
  /** Change handler */
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
  /** Auto-focus the operator select on mount */
  autoFocusOperator?: boolean;
}

export function StringFilter({
  field,
  label,
  widget = 'dropdown',
  options = [],
  includeOperators,
  excludeOperators,
  value,
  onChange,
  autoFocusOperator,
}: StringFilterProps) {
  const { t } = useTranslation();
  // Determine which operators to show
  const operators = STRING_OPERATORS.filter((op) => {
    if (includeOperators?.length) return includeOperators.includes(op.value);
    if (excludeOperators?.length) return !excludeOperators.includes(op.value);
    // For dropdown mode, default to $in/$nin/$exists/$notexists
    if (widget === 'dropdown') {
      return ['$in', '$nin', '$exists', '$notexists'].includes(op.value);
    }
    return true;
  });

  // Parse initial state from spec
  const initialOp = value ? (Object.keys(value)[0] as FilterOperator) : operators[0]?.value ?? '$contains';
  const initialVal = value?.[initialOp];

  const [operator, setOperator] = useState<FilterOperator>(initialOp);
  const [textValue, setTextValue] = useState(typeof initialVal === 'string' ? initialVal : '');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    () => new Set(Array.isArray(initialVal) ? initialVal : []),
  );

  const isNoInput = operators.find((o) => o.value === operator)?.noInput;

  const emitChange = useCallback(
    (op: FilterOperator, text: string, selected: Set<string>) => {
      const info = operators.find((o) => o.value === op);
      if (info?.noInput) {
        onChange(field, { [op]: true });
        return;
      }

      if (op === '$in' || op === '$nin') {
        if (selected.size === 0) {
          onChange(field, null);
        } else {
          onChange(field, { [op]: Array.from(selected) });
        }
        return;
      }

      if (!text.trim()) {
        onChange(field, null);
      } else {
        onChange(field, { [op]: text.trim() });
      }
    },
    [field, onChange, operators],
  );

  const handleOperatorChange = useCallback(
    (op: FilterOperator) => {
      setOperator(op);
      emitChange(op, textValue, selectedValues);
    },
    [textValue, selectedValues, emitChange],
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setTextValue(val);
    },
    [],
  );

  const handleTextCommit = useCallback(() => {
    emitChange(operator, textValue, selectedValues);
  }, [operator, textValue, selectedValues, emitChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        emitChange(operator, textValue, selectedValues);
      }
    },
    [operator, textValue, selectedValues, emitChange],
  );

  const toggleOption = useCallback(
    (opt: string) => {
      setSelectedValues((prev) => {
        const next = new Set(prev);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        emitChange(operator, textValue, next);
        return next;
      });
    },
    [operator, textValue, emitChange],
  );

  const selectAll = useCallback(() => {
    const all = new Set(options);
    setSelectedValues(all);
    emitChange(operator, textValue, all);
  }, [options, operator, textValue, emitChange]);

  const clearAll = useCallback(() => {
    const empty = new Set<string>();
    setSelectedValues(empty);
    emitChange(operator, textValue, empty);
  }, [operator, textValue, emitChange]);

  // Dropdown mode
  if (widget === 'dropdown' && (operator === '$in' || operator === '$nin')) {
    return (
      <div className="wcdv-filter wcdv-filter-string-dropdown flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <FilterOperatorSelect
            operators={operators}
            value={operator}
            onChange={handleOperatorChange}
            aria-label={`${label} ${t('FILTER.OPERATOR')}`}
            autoFocusOnMount={autoFocusOperator}
          />
          <MultiSelectDropdown
            options={options}
            selected={selectedValues}
            onToggle={toggleOption}
            onSelectAll={selectAll}
            onClearAll={clearAll}
            label={label}
          />
        </div>
      </div>
    );
  }

  // Textbox mode or $exists/$notexists
  return (
    <div className="wcdv-filter wcdv-filter-string flex items-center gap-1">
      <FilterOperatorSelect
        operators={operators}
        value={operator}
        onChange={handleOperatorChange}
        aria-label={`${label} ${t('FILTER.OPERATOR')}`}
        autoFocusOnMount={autoFocusOperator}
      />
      {!isNoInput && (
        <div className="flex-1 min-w-0">
          <Input
            size="sm"
            hideLabel
            label={label}
            value={textValue}
            onChange={handleTextChange}
            onBlur={handleTextCommit}
            onKeyDown={handleKeyDown}
            placeholder={label}
            aria-label={t('FILTER.VALUE_FOR', { param0: label })}
          />
        </div>
      )}
      {isNoInput && (
        <span className="text-xs text-gray-400 italic px-1" role="status">
          {t(operators.find((o) => o.value === operator)?.label ?? '')}
        </span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Multi-select dropdown (replaces SumoSelect)
// ───────────────────────────────────────────────────────────

interface MultiSelectDropdownProps {
  options: string[];
  selected: Set<string>;
  onToggle: (opt: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  label: string;
}

function MultiSelectDropdown({
  options,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  label,
}: MultiSelectDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const summary =
    selected.size === 0
      ? t('FILTER.SELECT_VALUES') || 'Select…'
      : selected.size === options.length
        ? t('FILTER.ALL_SELECTED') || 'All selected'
        : `${selected.size} selected`;

  return (
    <div className="wcdv-multiselect relative flex-1" ref={containerRef}>
      <Button
        ref={triggerRef}
        size="sm"
        variant="outline"
        onClick={() => setOpen((p) => !p)}
        className="w-full justify-between text-xs font-normal"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${summary}`}
      >
        <span className="truncate">{summary}</span>
        <span className="ml-1 text-gray-400" aria-hidden="true">▾</span>
      </Button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-0.5 w-full min-w-[180px] max-h-56 bg-white border border-gray-200 rounded shadow-lg flex flex-col"
          role="listbox"
          aria-label={`${label} options`}
        >
          {/* Search */}
          <div className="p-1 border-b border-gray-100">
            <Input
              size="sm"
              hideLabel
              label={t('FILTER.SEARCH_OPTIONS') || 'Search options'}
              type="text"
              className="text-xs"
              placeholder={t('FILTER.SEARCH') || 'Search…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('FILTER.SEARCH_OPTIONS') || 'Search options'}
            />
          </div>

          {/* Select All / Clear All */}
          <div className="flex gap-1 px-2 py-1 border-b border-gray-100 text-xs">
            <InlineActionButton
              type="button"
              className="text-blue-600 hover:underline"
              onClick={onSelectAll}
            >
              {t('FILTER.SELECT_ALL') || 'All'}
            </InlineActionButton>
            <span className="text-gray-300">|</span>
            <InlineActionButton
              type="button"
              className="text-blue-600 hover:underline"
              onClick={onClearAll}
            >
              {t('FILTER.CLEAR_ALL') || 'None'}
            </InlineActionButton>
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1 p-1">
            {filtered.length === 0 && (
              <div className="text-xs text-gray-400 px-2 py-1 italic">
                {t('FILTER.NO_RESULTS') || 'No results'}
              </div>
            )}
            {filtered.map((opt) => (
              <Checkbox
                key={opt}
                size="sm"
                label={opt || `(${t('FILTER.EMPTY') || 'empty'})`}
                checked={selected.has(opt)}
                onChange={() => onToggle(opt)}
                className="px-1 py-0.5"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
