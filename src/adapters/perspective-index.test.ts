import { describe, expect, it } from 'vitest';
import { deepEqual, mergeOrder, resolveCurrent, stableStringify } from './perspective-index';

describe('mergeOrder', () => {
  it('lists shipped defaults before user-created perspectives', () => {
    expect(mergeOrder(['a', 'b'], ['x', 'y'])).toEqual(['a', 'b', 'x', 'y']);
  });

  it('de-duplicates ids that appear in both layers', () => {
    expect(mergeOrder(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('preserves order and handles empty inputs', () => {
    expect(mergeOrder([], [])).toEqual([]);
    expect(mergeOrder(['a'], [])).toEqual(['a']);
    expect(mergeOrder([], ['x'])).toEqual(['x']);
  });
});

describe('resolveCurrent', () => {
  it('prefers the user selection over the shipped default', () => {
    expect(resolveCurrent('user-pick', 'shipped')).toBe('user-pick');
  });

  it('falls back to the shipped default when the user has no selection', () => {
    expect(resolveCurrent(null, 'shipped')).toBe('shipped');
  });

  it('returns null when neither layer has a selection', () => {
    expect(resolveCurrent(null, null)).toBeNull();
  });
});

describe('stableStringify / deepEqual', () => {
  it('treats objects as equal regardless of key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
    expect(deepEqual({ a: 1, b: { c: 3, d: 4 } }, { b: { d: 4, c: 3 }, a: 1 })).toBe(true);
  });

  it('distinguishes structurally different values', () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('matches a seeded perspective against an identical re-save', () => {
    const seeded = { id: 'p', name: 'P', config: { view: { group: ['x'] }, graph: { chartType: 'line' } } };
    const resaved = { id: 'p', name: 'P', config: { graph: { chartType: 'line' }, view: { group: ['x'] } } };
    expect(deepEqual(seeded, resaved)).toBe(true);
  });
});
