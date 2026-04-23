/**
 * export-utils — CSV export and clipboard copy utilities.
 *
 * Converts table rows + columns into RFC 4180 CSV and provides
 * download-as-file and copy-to-clipboard helpers.
 */

import type { TableRow, TableColumn } from './table/types';
import { formatCellValue, type DateFormatPreset } from './table/format-cell';

// ───────────────────────────────────────────────────────────
// CSV generation
// ───────────────────────────────────────────────────────────

/** Escape a cell value per RFC 4180: wrap in quotes if it contains comma, quote, or newline. */
function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert rows and columns to a CSV string.
 *
 * @param rows       Data rows to export.
 * @param columns    Visible columns in display order.
 * @param locale     BCP-47 locale for value formatting.
 * @param dateFormats Per-field date format overrides.
 */
export function rowsToCsv(
  rows: TableRow[],
  columns: TableColumn[],
  locale?: string,
  dateFormats?: Record<string, DateFormatPreset>,
): string {
  const header = columns.map((col) => escapeCsvCell(col.header ?? col.field));
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const raw = row.data[col.field];
        const formatted = formatCellValue(raw, col.typeInfo, locale, dateFormats?.[col.field]);
        return escapeCsvCell(formatted);
      })
      .join(','),
  );
  return [header.join(','), ...dataLines].join('\r\n');
}

// ───────────────────────────────────────────────────────────
// Download
// ───────────────────────────────────────────────────────────

/**
 * Trigger a CSV file download in the browser.
 *
 * @param csv      CSV content string.
 * @param filename File name for the download (should end in `.csv`).
 */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ───────────────────────────────────────────────────────────
// Clipboard
// ───────────────────────────────────────────────────────────

/**
 * Copy a string to the clipboard.
 *
 * @returns `true` on success, `false` on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────
// Filename helper
// ───────────────────────────────────────────────────────────

/** Build a sanitised CSV filename from a grid title and today's date. */
export function buildCsvFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '-') || 'export';
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-${date}.csv`;
}
