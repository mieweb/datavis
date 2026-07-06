import { describe, it, expect } from 'vitest';
import { columnToFilterConfig } from './FilterContext';
import type { TableColumn } from '../table/types';

const col = (field: string, type?: string): TableColumn => ({
  field,
  header: field,
  ...(type ? { typeInfo: { type } } : {}),
});

describe('columnToFilterConfig', () => {
  it('defaults string columns to the fast value-checklist dropdown', () => {
    expect(columnToFilterConfig(col('status', 'string')).widget).toBe('dropdown');
    expect(columnToFilterConfig(col('status')).widget).toBe('dropdown');
  });

  it('keeps tribool for booleans and textbox for numeric/date types', () => {
    expect(columnToFilterConfig(col('active', 'boolean')).widget).toBe('tribool');
    expect(columnToFilterConfig(col('amount', 'number')).widget).toBe('textbox');
    expect(columnToFilterConfig(col('when', 'date')).widget).toBe('textbox');
  });

  it('maps filter types from typeInfo', () => {
    expect(columnToFilterConfig(col('amount', 'currency')).filterType).toBe('currency');
    expect(columnToFilterConfig(col('when', 'datetime')).filterType).toBe('datetime');
  });
});
