import type { ViewData } from '../../adapters/use-data';
import type { RowData, TableColumn } from '../table/types';
import { formatCellValue, type DateFormatPreset } from '../table/format-cell';

export type SearchTextIndex = WeakMap<RowData, readonly string[]>;

export interface SearchTextOptions {
  locale?: string;
  dateFormats?: Record<string, DateFormatPreset>;
}

export interface HighlightedTextPart {
  text: string;
  match: boolean;
}

export function normalizeSearchText(value: string, locale?: string): string {
  return locale ? value.toLocaleLowerCase(locale) : value.toLocaleLowerCase();
}

export function normalizeSearchQuery(query: string, locale?: string): string {
  return normalizeSearchText(query.trim(), locale);
}

export function getCellSearchText(
  row: RowData,
  column: TableColumn,
  options: SearchTextOptions = {},
): string {
  const value = row[column.field];
  return column.getSearchText?.(value, row, column)
    ?? formatCellValue(value, column.typeInfo, options.locale, options.dateFormats?.[column.field]);
}

export function createSearchTextIndex(
  rows: RowData[],
  columns: TableColumn[],
  options: SearchTextOptions = {},
): SearchTextIndex {
  const index: SearchTextIndex = new WeakMap();

  for (const row of rows) {
    index.set(
      row,
      columns.map((column) => normalizeSearchText(getCellSearchText(row, column, options), options.locale)),
    );
  }

  return index;
}

export function filterRowsByGlobalSearch(
  rows: RowData[],
  query: string,
  index: SearchTextIndex,
  locale?: string,
): RowData[] {
  const needle = normalizeSearchQuery(query, locale);
  if (!needle) return rows;

  return rows.filter((row) => index.get(row)?.some((cellText) => cellText.includes(needle)) === true);
}

export function cellMatchesGlobalSearch(
  row: RowData,
  column: TableColumn,
  query: string,
  options: SearchTextOptions = {},
): boolean {
  const needle = normalizeSearchQuery(query, options.locale);
  return Boolean(
    needle
      && normalizeSearchText(getCellSearchText(row, column, options), options.locale).includes(needle),
  );
}

export function filterPlainViewData(
  viewData: ViewData | null,
  query: string,
  index: SearchTextIndex | null,
  locale?: string,
): ViewData | null {
  if (!viewData?.isPlain || !Array.isArray(viewData.data) || !index) return viewData;

  const rows = viewData.data as RowData[];
  const filteredRows = filterRowsByGlobalSearch(rows, query, index, locale);
  if (filteredRows === rows || filteredRows.length === rows.length) return viewData;

  const filteredRowIds = new Set(
    filteredRows
      .map((row) => row._rowId)
      .filter((rowId): rowId is string => typeof rowId === 'string'),
  );

  const filteredDataByRowId = viewData.dataByRowId
    ? Object.fromEntries(
        Object.entries(viewData.dataByRowId).filter(([rowId]) => filteredRowIds.has(rowId)),
      )
    : undefined;

  return {
    ...viewData,
    data: filteredRows,
    ...(filteredDataByRowId ? { dataByRowId: filteredDataByRowId } : {}),
  };
}

export function splitHighlightedText(
  text: string,
  query: string,
  locale?: string,
): HighlightedTextPart[] {
  const needle = normalizeSearchQuery(query, locale);
  if (!needle) return [{ text, match: false }];

  const normalizedText = normalizeSearchText(text, locale);
  const parts: HighlightedTextPart[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(needle);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), match: false });
    }
    const matchEnd = matchIndex + needle.length;
    parts.push({ text: text.slice(matchIndex, matchEnd), match: true });
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), match: false });
  }

  return parts.length > 0 ? parts : [{ text, match: false }];
}