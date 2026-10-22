import { describe, expect, it } from 'vitest';

import {
  RELATIVE_DATE_BUCKETS,
  formatFilterDate,
  relativeDateBucketOf,
  relativeDateBucketToFilter,
  resolveRelativeDateRanges,
} from './relative-date-groups';

type RangeFilter = { $gte?: string; $lt?: string };

// Thursday 7 May 2026, 15:00 local time.
const THURSDAY = new Date(2026, 4, 7, 15, 0, 0);

describe('resolveRelativeDateRanges', () => {
  it('resolves disjoint, newest-first ranges for a Monday week start', () => {
    const ranges = resolveRelativeDateRanges({ now: THURSDAY });

    expect(ranges.today).toEqual({ from: new Date(2026, 4, 7) });
    expect(ranges.this_week).toEqual({ from: new Date(2026, 4, 4), to: new Date(2026, 4, 7) });
    expect(ranges.this_month).toEqual({ from: new Date(2026, 4, 1), to: new Date(2026, 4, 4) });
    expect(ranges.this_year).toEqual({ from: new Date(2026, 0, 1), to: new Date(2026, 4, 1) });
    expect(ranges.older).toEqual({ to: new Date(2026, 0, 1) });
  });

  it('honours a Sunday week start', () => {
    const ranges = resolveRelativeDateRanges({ now: THURSDAY, weekStartsOn: 0 });
    expect(ranges.this_week.from).toEqual(new Date(2026, 4, 3));
    expect(ranges.this_month.to).toEqual(new Date(2026, 4, 3));
  });

  it('leaves "earlier this month" empty when the week began last month', () => {
    // Wednesday 1 July 2026: the week started Monday 29 June.
    const ranges = resolveRelativeDateRanges({ now: new Date(2026, 6, 1, 9) });
    expect(ranges.this_week).toEqual({ from: new Date(2026, 5, 29), to: new Date(2026, 6, 1) });
    expect(ranges.this_month).toEqual({ from: new Date(2026, 5, 29), to: new Date(2026, 5, 29) });
    expect(ranges.this_year).toEqual({ from: new Date(2026, 0, 1), to: new Date(2026, 5, 29) });
  });
});

describe('relativeDateBucketOf', () => {
  const ranges = resolveRelativeDateRanges({ now: THURSDAY });

  it.each([
    ['2026-05-07T09:00:00', 'today'],
    ['2026-05-08T09:00:00', 'today'],
    ['2026-05-04T00:00:00', 'this_week'],
    ['2026-05-06T23:59:59', 'this_week'],
    ['2026-05-02T12:00:00', 'this_month'],
    ['2026-02-01T12:00:00', 'this_year'],
    ['2025-12-31T23:59:59', 'older'],
  ])('puts %s in %s', (value, bucket) => {
    expect(relativeDateBucketOf(value, ranges)).toBe(bucket);
  });

  it('accepts Date objects and epoch milliseconds', () => {
    expect(relativeDateBucketOf(new Date(2026, 4, 5), ranges)).toBe('this_week');
    expect(relativeDateBucketOf(new Date(2026, 1, 1).getTime(), ranges)).toBe('this_year');
  });

  it('returns undefined for missing or invalid dates', () => {
    expect(relativeDateBucketOf(null, ranges)).toBeUndefined();
    expect(relativeDateBucketOf('', ranges)).toBeUndefined();
    expect(relativeDateBucketOf('not a date', ranges)).toBeUndefined();
  });
});

describe('relativeDateBucketToFilter', () => {
  it('derives a runtime date-range filter for a bucket', () => {
    expect(relativeDateBucketToFilter('this_week', { now: THURSDAY })).toEqual({
      $gte: '2026-05-04 00:00:00',
      $lt: '2026-05-07 00:00:00',
    });
    expect(relativeDateBucketToFilter('today', { now: THURSDAY })).toEqual({
      $gte: '2026-05-07 00:00:00',
    });
    expect(relativeDateBucketToFilter('older', { now: THURSDAY })).toEqual({
      $lt: '2026-01-01 00:00:00',
    });
  });

  it('matches exactly the population of its bucket', () => {
    const ranges = resolveRelativeDateRanges({ now: THURSDAY });
    const filters = Object.fromEntries(
      RELATIVE_DATE_BUCKETS.map((bucket) => [bucket, relativeDateBucketToFilter(bucket, { now: THURSDAY })]),
    ) as Record<string, RangeFilter>;
    // `YYYY-MM-DD HH:mm:ss` strings order chronologically, like the engine's date comparison.
    const passes = (filter: RangeFilter, value: string) =>
      (filter.$gte === undefined || value >= filter.$gte) && (filter.$lt === undefined || value < filter.$lt);

    for (let hour = 0; hour < 24 * 160; hour += 7) {
      const date = new Date(2025, 11, 1, hour);
      const value = formatFilterDate(date);
      const bucket = relativeDateBucketOf(date, ranges);
      const matching = RELATIVE_DATE_BUCKETS.filter((b) => passes(filters[b], value));
      expect(matching).toEqual([bucket]);
    }
  });
});
