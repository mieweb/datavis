import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseDateValue } from './parse-date';
import { relativeDateBucketOf, resolveRelativeDateRanges } from './relative-date-groups';
import { formatCellValue, formatDatePreset } from '../components/table/format-cell';

// Node applies TZ changes at runtime; pin zones on both sides of UTC so the
// suite catches the shift even on a CI runner that runs in UTC.
const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe.each(['America/Chicago', 'Pacific/Honolulu', 'UTC', 'Europe/Berlin', 'Asia/Tokyo'])(
  'in %s',
  (zone) => {
    beforeAll(() => {
      process.env.TZ = zone;
    });

    it('reads a YYYY-MM-DD calendar date as local midnight', () => {
      const date = parseDateValue('2026-11-01');
      expect(date).toBeDefined();
      expect([date!.getFullYear(), date!.getMonth(), date!.getDate(), date!.getHours()]).toEqual([
        2026, 10, 1, 0,
      ]);
    });

    it('formats a date-only cell as the same calendar day in every preset', () => {
      const date = { type: 'date' };
      expect(formatCellValue('2026-11-01', date, 'en-US')).toBe('11/01/26');
      expect(formatCellValue('2026-11-01', date, 'en-US', 'short4')).toBe('11/01/2026');
      expect(formatCellValue('2026-11-01', date, 'en-US', 'medium')).toBe('Nov 1, 2026');
      expect(formatCellValue('2026-11-01', date, 'en-US', 'long')).toBe('November 1, 2026');
      expect(formatCellValue('2026-11-01', date, 'en-US', 'iso')).toBe('2026-11-01');
      expect(formatCellValue('2026-01-01', date, 'en-US')).toBe('01/01/26');
    });

    it('keeps years 0–99 and pads ISO years', () => {
      const early = parseDateValue('0099-01-01');
      expect([early!.getFullYear(), early!.getMonth(), early!.getDate()]).toEqual([99, 0, 1]);
      const leap = parseDateValue('0000-02-29');
      expect([leap!.getFullYear(), leap!.getMonth(), leap!.getDate()]).toEqual([0, 1, 29]);
      const date = { type: 'date' };
      expect(formatCellValue('0999-01-01', date, 'en-US', 'iso')).toBe('0999-01-01');
      expect(formatCellValue('0099-12-31', date, 'en-US', 'iso')).toBe('0099-12-31');
      expect(formatCellValue('0000-02-29', date, 'en-US', 'iso')).toBe('0000-02-29');
      const far = new Date(2000, 0, 1);
      far.setFullYear(12345, 5, 7);
      expect(formatDatePreset(far, 'iso')).toBe('+012345-06-07');
      far.setFullYear(-44, 2, 15);
      expect(formatDatePreset(far, 'iso')).toBe('-000044-03-15');
    });

    it('buckets a date-only value by its local calendar day', () => {
      // Thursday 7 May 2026, 15:00 local; the week starts Monday 4 May.
      const ranges = resolveRelativeDateRanges({ now: new Date(2026, 4, 7, 15) });
      expect(relativeDateBucketOf('2026-05-04', ranges)).toBe('this_week');
      expect(relativeDateBucketOf('2026-05-07', ranges)).toBe('today');
      expect(relativeDateBucketOf('2026-05-03', ranges)).toBe('this_month');
    });
  },
);

describe('parseDateValue', () => {
  it('keeps the meaning of values that carry a time or are instants', () => {
    expect(parseDateValue('2026-11-01T00:00:00Z')?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    const epoch = Date.UTC(2026, 10, 1, 12);
    expect(parseDateValue(epoch)?.getTime()).toBe(epoch);
    const date = new Date(2026, 10, 1, 9, 30);
    expect(parseDateValue(date)).toBe(date);
  });

  it('rejects missing, invalid and rolled-over values', () => {
    expect(parseDateValue(null)).toBeUndefined();
    expect(parseDateValue('')).toBeUndefined();
    expect(parseDateValue('not a date')).toBeUndefined();
    expect(parseDateValue('2026-02-31')).toBeUndefined();
    expect(parseDateValue(new Date(Number.NaN))).toBeUndefined();
    expect(parseDateValue({})).toBeUndefined();
  });
});
