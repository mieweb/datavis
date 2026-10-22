/**
 * Relative date group function — buckets dates by how recently they fall
 * relative to "now" (Today / Earlier this week / … / Older), and derives a
 * concrete date-range filter for a bucket at runtime.
 *
 * The legacy group functions in `group_fun.js` map *absolute* buckets to
 * filters (`valueToFilter`: "2010 Oct" → Oct 1–31 2010). Relative buckets have
 * no fixed range, so the drill-down filter is resolved when it is applied:
 * "Earlier this week" on a Thursday becomes Monday 00:00 → Thursday 00:00.
 *
 * Buckets are disjoint and cover every valid date, so drilling into a bucket
 * reproduces exactly that bucket's population. Each range is half-open
 * (`from` inclusive, `to` exclusive) and computed in the runtime's local time
 * zone — the same zone the DataVis engine parses date strings in.
 */

import type { FieldFilterSpec } from '../components/filters/types';

/** Relative date buckets, newest first. */
export const RELATIVE_DATE_BUCKETS = [
  'today',
  'this_week',
  'this_month',
  'this_year',
  'older',
] as const;

export type RelativeDateBucket = (typeof RELATIVE_DATE_BUCKETS)[number];

/** Day the week starts on: 0 = Sunday … 6 = Saturday. */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RelativeDateOptions {
  /** Reference instant the buckets are relative to. Defaults to now. */
  now?: Date;
  /** First day of the week. Defaults to `1` (Monday, ISO 8601). */
  weekStartsOn?: WeekStartDay;
}

/** Half-open date range: `from` inclusive, `to` exclusive; either end may be open. */
export interface DateRange {
  from?: Date;
  to?: Date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Resolve every relative bucket to a concrete range for `now`. Each bucket
 * starts where the next-newer one would otherwise overlap it, e.g. when the
 * week began last month, "Earlier this month" is empty rather than
 * double-counting days already in "Earlier this week".
 */
export function resolveRelativeDateRanges(
  options: RelativeDateOptions = {},
): Record<RelativeDateBucket, DateRange> {
  const now = options.now ?? new Date();
  const weekStartsOn = options.weekStartsOn ?? 1;

  const today = startOfDay(now);
  const daysIntoWeek = (today.getDay() - weekStartsOn + 7) % 7;
  const week = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysIntoWeek);
  const month = earlier(new Date(today.getFullYear(), today.getMonth(), 1), week);
  const year = earlier(new Date(today.getFullYear(), 0, 1), month);

  return {
    today: { from: today },
    this_week: { from: week, to: today },
    this_month: { from: month, to: week },
    this_year: { from: year, to: month },
    older: { to: year },
  };
}

/** Parse a date-like value (Date, epoch ms, or date string) into a valid Date. */
export function toValidDate(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function inRange(time: number, range: DateRange): boolean {
  return (range.from == null || time >= range.from.getTime())
    && (range.to == null || time < range.to.getTime());
}

/**
 * The group function's value function: which relative bucket `value` falls in
 * for the given resolved ranges, or `undefined` for a missing/invalid date.
 */
export function relativeDateBucketOf(
  value: unknown,
  ranges: Record<RelativeDateBucket, DateRange>,
): RelativeDateBucket | undefined {
  const date = toValidDate(value);
  if (!date) return undefined;
  const time = date.getTime();
  return RELATIVE_DATE_BUCKETS.find((bucket) => inRange(time, ranges[bucket]));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local `YYYY-MM-DD HH:mm:ss`, the date format the legacy `valueToFilter` filters use. */
export function formatFilterDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Convert a half-open range into a DataVis field filter (`$gte` / `$lt`). */
export function dateRangeToFilter(range: DateRange): FieldFilterSpec {
  const filter: FieldFilterSpec = {};
  if (range.from) filter.$gte = formatFilterDate(range.from);
  if (range.to) filter.$lt = formatFilterDate(range.to);
  return filter;
}

/**
 * The group function's `valueToFilter`, resolved at runtime: the field filter
 * matching exactly the dates in `bucket` as of `options.now` (default: now).
 */
export function relativeDateBucketToFilter(
  bucket: RelativeDateBucket,
  options: RelativeDateOptions = {},
): FieldFilterSpec {
  return dateRangeToFilter(resolveRelativeDateRanges(options)[bucket]);
}
