/**
 * StringFilter — filter component for string-type columns.
 *
 * Renders either a text input (with operator dropdown) or a multi-select
 * dropdown using @mieweb/ui depending on the widget hint.
 */

import { useState, useCallback } from 'react';
import { Input } from '@mieweb/ui/components/Input';
import { Button } from '@mieweb/ui/components/Button';
import { Dropdown, DropdownContent, DropdownItem } from '@mieweb/ui/components/Dropdown';
import { useTranslation } from 'react-i18next';
import { ChevronGlyphIcon } from '../ui';
import { FilterOperatorSelect } from './FilterOperatorSelect';
import {
  STRING_OPERATORS,
  type FilterOperator,
  type FieldFilterSpec,
} from './types';

export interface StringFilterProps {
  field: string;
  label: string;
  widget?: 'textbox' | 'dropdown';
  options?: string[];
  includeOperators?: FilterOperator[];
  excludeOperators?: FilterOperator[];
  value?: FieldFilterSpec;
  onChange: (field: string, spec: FieldFilterSpec | null) => void;
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

  const operators = STRING_OPERATORS.filter((operatorInfo) => {
    if (includeOperators?.length) return includeOperators.includes(operatorInfo.value);
    if (excludeOperators?.length) return !excludeOperators.includes(operatorInfo.value);
    if (widget === 'dropdown') {
      return ['$in', '$nin', '$exists', '$notexists'].includes(operatorInfo.value);
    }
    return true;
  });

  const initialOperator = value
    ? (Object.keys(value)[0] as FilterOperator)
    : operators[0]?.value ?? '$contains';
  const initialValue = value?.[initialOperator];

  const [operator, setOperator] = useState<FilterOperator>(initialOperator);
  const [textValue, setTextValue] = useState(typeof initialValue === 'string' ? initialValue : '');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    () => new Set(Array.isArray(initialValue) ? initialValue : []),
  );

  const isNoInput = operators.find((operatorInfo) => operatorInfo.value === operator)?.noInput;

  const emitChange = useCallback(
    (nextOperator: FilterOperator, nextTextValue: string, nextSelectedValues: Set<string>) => {
      const operatorInfo = operators.find((candidate) => candidate.value === nextOperator);
      if (operatorInfo?.noInput) {
        onChange(field, { [nextOperator]: true });
        return;
      }

      if (nextOperator === '$in' || nextOperator === '$nin') {
        if (nextSelectedValues.size === 0) {
          onChange(field, null);
        } else {
          onChange(field, { [nextOperator]: Array.from(nextSelectedValues) });
        }
        return;
      }

      if (!nextTextValue.trim()) {
        onChange(field, null);
        return;
      }

      onChange(field, { [nextOperator]: nextTextValue.trim() });
    },
    [field, onChange, operators],
  );

  const handleOperatorChange = useCallback(
    (nextOperator: FilterOperator) => {
      setOperator(nextOperator);
      emitChange(nextOperator, textValue, selectedValues);
    },
    [emitChange, selectedValues, textValue],
  );

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTextValue(event.target.value);
  }, []);

  const handleTextCommit = useCallback(() => {
    emitChange(operator, textValue, selectedValues);
  }, [emitChange, operator, selectedValues, textValue]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        emitChange(operator, textValue, selectedValues);
      }
    },
    [emitChange, operator, selectedValues, textValue],
  );

  const handleSelectedValuesChange = useCallback(
    (nextValues: string[]) => {
      const nextSelectedValues = new Set(nextValues);
      setSelectedValues(nextSelectedValues);
      emitChange(operator, textValue, nextSelectedValues);
    },
    [emitChange, operator, textValue],
  );

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
            selectedValues={Array.from(selectedValues)}
            onSelectedValuesChange={handleSelectedValuesChange}
            label={label}
          />
        </div>
      </div>
    );
  }

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
        <span className="px-1 text-xs italic text-gray-400" role="status">
          {t(operators.find((operatorInfo) => operatorInfo.value === operator)?.label ?? '')}
        </span>
      )}
    </div>
  );
}

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  label: string;
}

function MultiSelectDropdown({
  options,
  selectedValues,
  onSelectedValuesChange,
  label,
}: MultiSelectDropdownProps) {
  const { t } = useTranslation();

  const summary =
    selectedValues.length === 0
      ? t('FILTER.SELECT_VALUES') || 'Select…'
      : selectedValues.length === options.length
        ? t('FILTER.ALL_SELECTED') || 'All selected'
        : `${selectedValues.length} selected`;

  return (
    <Dropdown
      placement="bottom-start"
      width="trigger"
      searchable
      multiSelect
      showSelectAll
      selectedValues={selectedValues}
      onSelectedValuesChange={onSelectedValuesChange}
      searchPlaceholder={t('FILTER.SEARCH') || 'Search…'}
      searchAriaLabel={t('FILTER.SEARCH_OPTIONS') || 'Search options'}
      searchEmptyState={(
        <div className="px-3 py-2 text-xs italic text-gray-400">
          {t('FILTER.NO_RESULTS') || 'No results'}
        </div>
      )}
      selectAllLabel={t('FILTER.SELECT_ALL') || 'Select all'}
      trigger={(
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between text-xs font-normal"
          aria-label={`${label}: ${summary}`}
        >
          <span className="truncate">{summary}</span>
          <span className="ml-1 text-gray-400" aria-hidden="true">
            <ChevronGlyphIcon className="h-3.5 w-3.5" direction="down" />
          </span>
        </Button>
      )}
    >
      <DropdownContent className="max-h-56 overflow-auto py-1">
        {options.map((option) => (
          <DropdownItem key={option} value={option} searchText={option}>
            {option || `(${t('FILTER.EMPTY') || 'empty'})`}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
