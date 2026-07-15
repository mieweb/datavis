import { describe, expect, it } from 'vitest';

import {
  isAggregateEntryComplete,
  isAggregateEntryCommitted,
} from './aggregate-utils';
import type { AggregateEntry } from './AggregateSection';

/**
 * These rules guard the "don't set the aggregate until the field is picked"
 * behavior: an aggregate is only pushed to the view once every required field
 * argument is filled, so functions like `sum` never emit an
 * "Invalid Aggregate … unknown field" error while the user is still choosing a
 * field. Field-less functions like `count` commit immediately.
 */
function makeEntry(overrides: Partial<AggregateEntry> = {}): AggregateEntry {
  return {
    id: 'agg-1',
    functionName: 'sum',
    fields: ['salary'],
    visible: true,
    ...overrides,
  };
}

describe('isAggregateEntryComplete', () => {
  it('treats a field-less function (e.g. count) as complete', () => {
    expect(isAggregateEntryComplete(makeEntry({ functionName: 'count', fields: [] }))).toBe(true);
  });

  it('is incomplete while a required field argument is still empty', () => {
    expect(isAggregateEntryComplete(makeEntry({ fields: [''] }))).toBe(false);
  });

  it('is complete once every required field is filled', () => {
    expect(isAggregateEntryComplete(makeEntry({ fields: ['salary'] }))).toBe(true);
    expect(
      isAggregateEntryComplete(makeEntry({ functionName: 'sumSum', fields: ['a', 'b'] })),
    ).toBe(true);
  });

  it('is incomplete when any of several fields is empty', () => {
    expect(
      isAggregateEntryComplete(makeEntry({ functionName: 'sumSum', fields: ['a', ''] })),
    ).toBe(false);
  });
});

describe('isAggregateEntryCommitted', () => {
  it('commits a visible, fully-specified entry', () => {
    expect(isAggregateEntryCommitted(makeEntry())).toBe(true);
  });

  it('does not commit an entry that is still missing its field', () => {
    expect(isAggregateEntryCommitted(makeEntry({ fields: [''] }))).toBe(false);
  });

  it('does not commit a hidden entry even when complete', () => {
    expect(isAggregateEntryCommitted(makeEntry({ visible: false }))).toBe(false);
  });

  it('commits a field-less function immediately', () => {
    expect(
      isAggregateEntryCommitted(makeEntry({ functionName: 'count', fields: [] })),
    ).toBe(true);
  });
});
