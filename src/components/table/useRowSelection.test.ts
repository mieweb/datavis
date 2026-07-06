import { describe, it, expect } from 'vitest';
import {
  headerCheckState,
  toggleRowSelection,
  toggleAllRows,
} from './useRowSelection';
import type { SelectionState } from './types';

const sel = (nums: number[]): SelectionState => ({
  selectedRows: new Set(nums),
  activeRow: null,
  activeColumn: null,
});

const rows = (nums: number[]) => nums.map((rowNum) => ({ rowNum }));

describe('headerCheckState', () => {
  it('is none when nothing is selected or no rows render', () => {
    expect(headerCheckState(new Set(), rows([0, 1]))).toBe('none');
    expect(headerCheckState(new Set([1]), rows([]))).toBe('none');
  });

  it('is some when a strict subset of rendered rows is selected', () => {
    expect(headerCheckState(new Set([1]), rows([0, 1, 2]))).toBe('some');
  });

  it('is all when every rendered row is selected', () => {
    expect(headerCheckState(new Set([0, 1, 2]), rows([0, 1, 2]))).toBe('all');
  });

  it('ignores selections of rows that are filtered out', () => {
    // rows 5 and 6 were selected before a filter hid them
    expect(headerCheckState(new Set([5, 6]), rows([0, 1]))).toBe('none');
    expect(headerCheckState(new Set([0, 5]), rows([0, 1]))).toBe('some');
    expect(headerCheckState(new Set([0, 1, 5]), rows([0, 1]))).toBe('all');
  });
});

describe('toggleRowSelection', () => {
  it('adds an unselected row and makes it active', () => {
    const next = toggleRowSelection(sel([1]), 2);
    expect([...next.selectedRows].sort()).toEqual([1, 2]);
    expect(next.activeRow).toBe(2);
  });

  it('removes a selected row (accumulative toggling)', () => {
    const next = toggleRowSelection(sel([1, 2]), 2);
    expect([...next.selectedRows]).toEqual([1]);
  });
});

describe('toggleAllRows', () => {
  it('selects every rendered (filtered) row when none are selected', () => {
    const next = toggleAllRows(sel([]), rows([0, 1, 2]));
    expect([...next.selectedRows].sort()).toEqual([0, 1, 2]);
  });

  it('completes a partial selection instead of clearing it', () => {
    const next = toggleAllRows(sel([1]), rows([0, 1, 2]));
    expect([...next.selectedRows].sort()).toEqual([0, 1, 2]);
  });

  it('clears only rendered rows when all are selected, preserving filtered-out picks', () => {
    // rows 0-2 rendered and selected; row 9 selected but filtered out
    const next = toggleAllRows(sel([0, 1, 2, 9]), rows([0, 1, 2]));
    expect([...next.selectedRows]).toEqual([9]);
  });

  it('applies select-all to the filtered subset only', () => {
    // status filter narrowed the view to rows 3 and 4
    const next = toggleAllRows(sel([]), rows([3, 4]));
    expect([...next.selectedRows].sort()).toEqual([3, 4]);
  });
});
