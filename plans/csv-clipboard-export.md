# Plan A: CSV / Clipboard Export

**TL;DR**: Add "Download CSV" and "Copy to Clipboard" buttons to the TitleBar, backed by a new `export-utils.ts` utility that serializes visible columns/rows using the existing `formatCellValue()` pipeline. Lowest effort, highest immediacy.

## Steps

### Phase 1 — Export utility (no UI changes)

1. Create `src/components/export-utils.ts` with two functions:
   - `rowsToCsv(rows: TableRow[], columns: TableColumn[], formatCell, locale, dateFormats)` — iterate visible columns, build header row from `column.header`, build data rows from `row.data[column.field]` formatted via `formatCellValue()`, escape quotes/commas per RFC 4180, return CSV string.
   - `downloadCsv(csv: string, filename: string)` — create Blob, URL.createObjectURL, trigger `<a>` click download, revoke URL.
   - `copyRowsToClipboard(csv: string)` — `navigator.clipboard.writeText(csv)`.

### Phase 2 — Wire into DataGrid + TitleBar

2. Add `onExportCsv?: () => void` and `onCopyClipboard?: () => void` to `TitleBarProps` in `TitleBar.tsx`.
3. Add two buttons to TitleBar's toolbar area (after Refresh, before Controls) following the existing `Tooltip > Button > Icon` pattern. Use existing i18n keys `GRID.TITLEBAR.DOWNLOAD_CSV` and add `GRID.TITLEBAR.COPY_CLIPBOARD`.
4. In `DataGrid.tsx`, create handler functions that:
   - Pull full row data from `viewState.data` (NOT `limitedViewData`) so export includes all rows
   - Compute visible columns from `columnConfigs` (respecting hidden/order)
   - Call `rowsToCsv()` then `downloadCsv()` or `copyRowsToClipboard()`
   - Pass handlers as props to `<TitleBar>`
5. Add i18n key `GRID.TITLEBAR.COPY_CLIPBOARD: "Copy to Clipboard"` in `en-US.json`.

### Phase 3 — Polish

6. Add toast/status feedback after clipboard copy (success/fail). Use the existing `status` region in the controls area.
7. Export the utility from `src/components/index.ts` barrel.

## Relevant Files

| File | Purpose |
|------|---------|
| `src/components/export-utils.ts` | **NEW** — core CSV/clipboard logic |
| `src/components/TitleBar.tsx` | Add export buttons to toolbar (L131-165) |
| `src/components/DataGrid.tsx` | Create handlers using `viewState.data` + `columnConfigs` (L280+) |
| `src/components/table/format-cell.ts` | Reuse `formatCellValue()` for consistent formatting |
| `src/components/table/types.ts` | `TableRow`, `TableColumn` types |
| `src/i18n/en-US.json` | Add `COPY_CLIPBOARD` key (~L241) |
| `src/components/index.ts` | Export new utility |

## Verification

1. Open demo at localhost:5173, Simple tab → click Download CSV → file downloads with 8 rows, correct headers
2. Large (5K) tab → click Download CSV → CSV has all 5000 rows (not just the visible 100)
3. Copy to Clipboard → paste into text editor → matches CSV output
4. Verify formatted values (dates as MM/DD/YY, numbers with commas) match what's displayed in the table
5. Run `npx eslint src/components/export-utils.ts src/components/TitleBar.tsx src/components/DataGrid.tsx`
6. Run existing E2E tests: `npx playwright test`

## Decisions

- Export ALL rows (from `viewState.data`), not just the visible/limited subset — users expect full data
- Use `formatCellValue()` for export values so CSV matches on-screen display
- Filename: `{gridTitle}-{ISO date}.csv`
- No Excel (.xlsx) in v1 — CSV covers 90% of use cases without adding a dependency
