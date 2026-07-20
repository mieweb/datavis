import { describe, expect, it, vi } from 'vitest';

import type { ViewData } from '../../adapters/use-data';
import type { RowData, TableColumn } from '../table/types';
import { formatCellValue } from '../table/format-cell';
import {
  createSearchTextIndex,
  filterPlainViewData,
  filterRowsByGlobalSearch,
  splitHighlightedText,
} from './search-utils';

const rows: RowData[] = [
  { _rowId: 'row-1', name: 'Alice', department: 'Engineering', hired: '2019-03-14' },
  { _rowId: 'row-2', name: 'Bob', department: 'Operations', hired: '2020-07-06' },
];

const columns: TableColumn[] = [
  { field: 'name', header: 'Name', typeInfo: { type: 'string' } },
  { field: 'department', header: 'Department', typeInfo: { type: 'string' } },
  { field: 'hired', header: 'Hired', typeInfo: { type: 'date' } },
];

describe('global search utilities', () => {
  it('matches case-insensitively across only the supplied visible columns', () => {
    const visibleColumns = columns.slice(0, 2);
    const index = createSearchTextIndex(rows, visibleColumns, { locale: 'en-US' });

    expect(filterRowsByGlobalSearch(rows, 'ENGINEER', index, 'en-US')).toEqual([rows[0]]);

    const nameOnlyIndex = createSearchTextIndex(rows, [columns[0]], { locale: 'en-US' });
    expect(filterRowsByGlobalSearch(rows, 'operations', nameOnlyIndex, 'en-US')).toEqual([]);
  });

  it('matches formatted dates and custom display text', () => {
    const getSearchText = vi.fn(() => 'Primary engineer');
    const searchableColumns: TableColumn[] = [
      { ...columns[0], getSearchText },
      columns[2],
    ];
    const index = createSearchTextIndex(rows, searchableColumns, {
      locale: 'en-US',
      dateFormats: { hired: 'long' },
    });

    expect(filterRowsByGlobalSearch(rows, 'primary', index, 'en-US')).toHaveLength(2);
    const displayedDate = formatCellValue(rows[0].hired, columns[2].typeInfo, 'en-US', 'long');
    expect(filterRowsByGlobalSearch(rows, displayedDate, index, 'en-US')).toEqual([rows[0]]);

    filterRowsByGlobalSearch(rows, 'engineer', index, 'en-US');
    expect(getSearchText).toHaveBeenCalledTimes(rows.length);
  });

  it('preserves row order and synchronizes dataByRowId', () => {
    const viewData = {
      isPlain: true,
      isGroup: false,
      isPivot: false,
      data: rows,
      dataByRowId: {
        'row-1': rows[0],
        'row-2': rows[1],
      },
    } as ViewData;
    const index = createSearchTextIndex(rows, columns);

    const result = filterPlainViewData(viewData, 'alice', index);

    expect(result?.data).toEqual([rows[0]]);
    expect(result?.dataByRowId).toEqual({ 'row-1': rows[0] });
    expect(viewData.data).toEqual(rows);
  });

  it('returns the original rows and view data for an empty query', () => {
    const index = createSearchTextIndex(rows, columns);
    const viewData = { isPlain: true, isGroup: false, isPivot: false, data: rows } as ViewData;

    expect(filterRowsByGlobalSearch(rows, '   ', index)).toBe(rows);
    expect(filterPlainViewData(viewData, '', index)).toBe(viewData);
  });

  it('splits every non-overlapping match while preserving original casing', () => {
    expect(splitHighlightedText('Engineering engineer', 'engineer')).toEqual([
      { text: 'Engineer', match: true },
      { text: 'ing ', match: false },
      { text: 'engineer', match: true },
    ]);
  });

  it('scans a cached 5K-row index in under 100ms', () => {
    const largeRows = Array.from({ length: 5000 }, (_, index) => ({
      _rowId: `row-${index}`,
      name: `Employee ${index}`,
      department: index % 2 === 0 ? 'Engineering' : 'Operations',
    }));
    const largeColumns: TableColumn[] = [
      { field: 'name', header: 'Name' },
      { field: 'department', header: 'Department' },
    ];
    const index = createSearchTextIndex(largeRows, largeColumns, { locale: 'en-US' });
    const startedAt = performance.now();

    const matches = filterRowsByGlobalSearch(largeRows, 'Employee 4999', index, 'en-US');

    expect(performance.now() - startedAt).toBeLessThan(100);
    expect(matches).toEqual([largeRows[4999]]);
  });

});