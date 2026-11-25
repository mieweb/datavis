/**
 * parse-date — turn a cell's date value into a `Date` without shifting
 * calendar dates across time zones.
 *
 * `new Date('2026-11-01')` is specified to parse a date-only ISO string as
 * UTC midnight, so anywhere west of UTC it lands on the evening of Oct 31
 * and every local-time formatter shows the previous day. A date-only value
 * is a calendar date, not an instant, so it is read as local midnight.
 * Strings with a time part (and epoch numbers / Dates) keep their meaning.
 */

/** A bare `YYYY-MM-DD` calendar date with no time component. */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `value` is a bare `YYYY-MM-DD` calendar date (no time part). */
export function isDateOnlyString(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY_RE.test(value.trim());
}

/**
 * Parse a date-like value (Date, epoch ms, or date string) into a valid Date,
 * reading `YYYY-MM-DD` as local midnight. Returns `undefined` for a missing
 * or unparseable value.
 */
export function parseDateValue(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'string') {
    const match = DATE_ONLY_RE.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      // setFullYear, not new Date(y, m, d): the constructor maps years 0–99
      // to 1900–1999.
      const date = new Date(2000, 0, 1);
      date.setFullYear(year, month, day);
      // Reject roll-overs such as 2026-02-31 → Mar 3.
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
        ? date
        : undefined;
    }
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
