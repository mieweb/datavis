import { describe, it, expect } from 'vitest';
import { getStableRowId } from './row-identity';

describe('getStableRowId', () => {
  it('uses the engine _rowId when present', () => {
    expect(getStableRowId({ _rowId: '7', name: 'x' }, 0)).toBe(7);
    expect(getStableRowId({ _rowId: 7 }, 0)).toBe(7);
  });

  it('returns the same id for the same _rowId across rebuilt row objects', () => {
    const a = { _rowId: '3', name: 'Alice' };
    const b = { _rowId: '3', name: 'Alice' }; // rebuilt object, same row
    expect(getStableRowId(a, 0)).toBe(getStableRowId(b, 5));
  });

  it('assigns a persistent negative id to rows without _rowId', () => {
    const row = { name: 'x' };
    const id = getStableRowId(row, 2);
    expect(id).toBeLessThan(0);
    expect(getStableRowId(row, 9)).toBe(id);
  });

  it('gives distinct ids to distinct rows without _rowId', () => {
    expect(getStableRowId({ a: 1 }, 0)).not.toBe(getStableRowId({ a: 1 }, 0));
  });

  it('falls back to the index for non-object rows', () => {
    expect(getStableRowId(null, 4)).toBe(4);
    expect(getStableRowId('str', 2)).toBe(2);
  });
});
