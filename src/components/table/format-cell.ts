/**
 * format-cell — shared cell-value formatting for all table renderers.
 *
 * Centralises the "how to display a raw value" logic so PlainTable,
 * GroupDetailTable (and future renderers) stay DRY.
 *
 * The `locale` parameter is a BCP-47 tag (e.g. `'en-US'`, `'fr-FR'`)
 * obtained from `useLocale()`.  When `undefined` the browser's default
 * locale is used, which gives US users the familiar MM/DD/YY format.
 */

/** Matches ISO-ish date strings like "2019-03-15" or "2019-03-15T10:30". */
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// ───────────────────────────────────────────────────────────
// Named date format presets
// ───────────────────────────────────────────────────────────

/** All supported date format preset names. */
export type DateFormatPreset =
  | 'short'       // 03/14/19
  | 'short4'      // 03/14/2019
  | 'medium'      // Mar 14, 2019
  | 'long'        // March 14, 2019
  | 'iso'         // 2019-03-14
  | 'relative';   // 6 years ago

/** Display labels for format presets (English defaults — i18n keys below). */
export const DATE_FORMAT_PRESETS: { key: DateFormatPreset; label: string; example: string }[] = [
  { key: 'short',    label: 'Short',             example: '03/14/19'      },
  { key: 'short4',   label: 'Short (4-digit yr)', example: '03/14/2019'   },
  { key: 'medium',   label: 'Medium',            example: 'Mar 14, 2019'  },
  { key: 'long',     label: 'Long',              example: 'March 14, 2019'},
  { key: 'iso',      label: 'ISO 8601',          example: '2019-03-14'    },
  { key: 'relative', label: 'Relative',          example: '6 years ago'   },
];

/** Intl options for each preset (relative is handled separately). */
const DATE_OPTIONS: Record<Exclude<DateFormatPreset, 'relative'>, Intl.DateTimeFormatOptions> = {
  short:  { month: '2-digit', day: '2-digit', year: '2-digit'  },
  short4: { month: '2-digit', day: '2-digit', year: 'numeric'  },
  medium: { month: 'short',   day: 'numeric', year: 'numeric'  },
  long:   { month: 'long',    day: 'numeric', year: 'numeric'  },
  iso:    {}, // handled manually
};

const DATETIME_TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/**
 * Format a Date using a named preset.
 *
 * @param d       Parsed Date object.
 * @param preset  Format preset name (default `'short'`).
 * @param isDatetime  Whether to include time component.
 * @param locale  BCP-47 tag or undefined for browser default.
 */
export function formatDatePreset(
  d: Date,
  preset: DateFormatPreset = 'short',
  isDatetime = false,
  locale?: string,
): string {
  if (preset === 'relative') {
    return formatRelativeDate(d);
  }
  if (preset === 'iso') {
    const iso = d.toISOString();
    return isDatetime ? iso.replace('T', ' ').slice(0, 16) : iso.slice(0, 10);
  }
  const opts: Intl.DateTimeFormatOptions = {
    ...DATE_OPTIONS[preset],
    ...(isDatetime ? DATETIME_TIME : {}),
  };
  return isDatetime
    ? d.toLocaleString(locale, opts)
    : d.toLocaleDateString(locale, opts);
}

/** Format a date as a relative time string (e.g. "3 months ago", "in 2 days"). */
function formatRelativeDate(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const absDiff = Math.abs(diffMs);
  const past = diffMs >= 0;

  const MINUTE = 60_000;
  const HOUR   = 3_600_000;
  const DAY    = 86_400_000;
  const MONTH  = 30.44 * DAY;
  const YEAR   = 365.25 * DAY;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (absDiff < MINUTE)       { return 'just now'; }
  else if (absDiff < HOUR)    { value = Math.round(absDiff / MINUTE); unit = 'minute'; }
  else if (absDiff < DAY)     { value = Math.round(absDiff / HOUR);   unit = 'hour'; }
  else if (absDiff < MONTH)   { value = Math.round(absDiff / DAY);    unit = 'day'; }
  else if (absDiff < YEAR)    { value = Math.round(absDiff / MONTH);  unit = 'month'; }
  else                        { value = Math.round(absDiff / YEAR);   unit = 'year'; }

  // Use Intl.RelativeTimeFormat when available (all modern browsers)
  if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    return rtf.format(past ? -value : value, unit);
  }
  // Fallback
  const s = value === 1 ? '' : 's';
  return past ? `${value} ${unit}${s} ago` : `in ${value} ${unit}${s}`;
}

/**
 * Format a cell value using the column's type information.
 *
 * - `null` / `undefined` → `''`
 * - `number` → locale-formatted string  (e.g. `125,000`)
 * - date / datetime strings → locale-formatted date
 * - everything else → `String(value)`
 *
 * @param value      Raw cell value.
 * @param typeInfo   Column type metadata (optional).
 * @param locale     BCP-47 locale tag, or `undefined` for browser default.
 * @param dateFormat Named date format preset (default `'short'`).
 */
export function formatCellValue(
  value: unknown,
  typeInfo?: { type?: string },
  locale?: string,
  dateFormat?: DateFormatPreset,
): string {
  if (value == null) return '';
  if (typeof value === 'number') return value.toLocaleString(locale);

  const s = String(value);
  const t = typeInfo?.type;

  if ((t === 'date' || t === 'datetime') && DATE_RE.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return formatDatePreset(d, dateFormat ?? 'short', t === 'datetime', locale);
    }
  }

  return s;
}

/**
 * Format a numeric aggregate value with locale-aware formatting.
 *
 * @param value     Raw aggregate value.
 * @param locale    BCP-47 locale tag, or `undefined` for browser default.
 * @param maxFrac   Maximum fraction digits (default 2).
 */
export function formatAggregateNumber(
  value: unknown,
  locale?: string,
  maxFrac = 2,
): string {
  const num = Number(value);
  if (isNaN(num) || typeof value === 'boolean') return String(value ?? '');
  return num.toLocaleString(locale, { maximumFractionDigits: maxFrac });
}

export function getAggregateValueForField(
  aggregates: Record<string, unknown> | undefined,
  field: string,
): unknown {
  if (!aggregates) return undefined;
  if (aggregates[field] != null) return aggregates[field];

  for (const [key, value] of Object.entries(aggregates)) {
    const match = key.match(/^\w+\((.+)\)$/);
    if (match?.[1] === field) return value;
  }

  return undefined;
}
