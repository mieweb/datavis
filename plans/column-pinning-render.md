# Plan B: Column Pinning Render

**TL;DR**: The pinning data model, adapter, and persistence all exist. The gap is purely in PlainTable rendering: apply `position: sticky` + computed `left` offsets to pinned column `<th>` and `<td>` cells, add a visual separator shadow, and constrain drag-reorder to respect the pin boundary.

## Steps

### Phase 1 — Render pinned columns with sticky positioning

1. In `PlainTable.tsx`, partition `visibleColumns` into `pinnedColumns` and `scrollableColumns` within the existing `useMemo` (~L285-297). Pinned columns always come first (already enforced by `determineColumns()` in `colconfig-adapter.ts`).
2. Compute cumulative left offsets: `pinnedOffsets[i] = sum(pinnedColumns[0..i-1].width)`. Recompute when column widths change (tie into `useColumnResize` width state).
3. For each pinned column's `<th>` and `<td>`, apply inline styles: `position: 'sticky', left: pinnedOffsets[i], zIndex: pinnedColumns.length - i` (higher z for leftmost so they stack correctly).
4. Header cells for pinned columns need `z-index` higher than both the sticky header AND other pinned cells (they're sticky in both axes). Use `z-20` for pinned header cells vs `z-10` for the sticky header row.
5. Apply the same sticky styles to pinned cells in `<AggregateFooter>` (`<tfoot>`) so they align.

### Phase 2 — Visual separator

6. Add a right box-shadow or border on the last pinned column's `<th>` and `<td>` to create a visual "freeze pane" separator. Something like `box-shadow: 2px 0 4px -1px rgba(0,0,0,0.1)` on the last pinned column.

### Phase 3 — Drag reorder constraint

7. In PlainTable's `handleHeaderDragOver` / `handleHeaderDrop` (~L318-385), add a constraint: if dragging a pinned column, only allow drop targets that are also pinned. If dragging an unpinned column, only allow unpinned targets. This prevents breaking the pin boundary.

### Phase 4 — Context menu pin toggle

8. In the header context menu items (built in `PlainTable.tsx` or `TableRenderer.tsx`), add a "Pin Column" / "Unpin Column" toggle. On click, update `columnConfigs` via `setColumnConfig` to flip the `isPinned` flag, which triggers re-render with the column in its new partition.

### Phase 5 — ColumnConfigDialog pin toggle (optional)

9. In `ColumnConfigDialog.tsx`, add a pin/unpin icon button per column row (currently missing despite the `isPinned` field existing in the config type).

## Relevant Files

| File | Purpose |
|------|---------|
| `src/components/table/PlainTable.tsx` | Core rendering changes: sticky styles on pinned `<th>`/`<td>`, offset computation, drag constraint (L285-297 column memo, L688-700 header render, L706-754 body render, L318-385 drag handlers) |
| `src/components/table/types.ts` | `TableColumn.pinned` already defined at L30 |
| `src/adapters/colconfig-adapter.ts` | `determineColumns()` already sorts pinned-first (L136-162) |
| `src/components/DataGrid.tsx` | Column config pipeline (L222-254) |
| `src/components/dialogs/ColumnConfigDialog.tsx` | Add pin toggle UI |
| `src/components/table/HeaderContextMenu.tsx` | Pin/unpin menu item |
| `src/components/table/GroupDetailTable.tsx` | Future: same treatment (excluded from this plan) |
| `src/components/table/GroupSummaryTable.tsx` | Future: same treatment (excluded from this plan) |

## Verification

1. Open Simple demo → open Column Config dialog → pin "Name" and "ID" columns → scroll right → pinned columns stay fixed on the left
2. Verify pinned header cells remain visible when scrolling both horizontally AND vertically (dual-sticky)
3. Verify the shadow separator is visible after the last pinned column
4. Drag a pinned column — it should only reorder among other pinned columns
5. Drag an unpinned column — it should not be droppable before pinned columns
6. Right-click a header → "Pin Column" → column moves to pinned area
7. Wide (50 columns) tab — pin 2-3 columns, scroll right extensively, verify alignment stays correct
8. Resize a pinned column → subsequent pinned columns shift their sticky offset correctly
9. Run E2E tests: `npx playwright test`

## Decisions

- Pin to left only (no right-pin in v1) — matches AG Grid's default and covers 95% of use cases
- GroupDetailTable and GroupSummaryTable pinning is out of scope for this plan
- Pin state persists via existing `colconfig-adapter` round-trip (already works)
