# Plan: Sticky Floating Column Headers

The `<thead>` already has `position: sticky; top: 0;` but it's broken because intermediate containers with `overflow: auto` create non-scrolling scroll contexts that capture the sticky. Fix by removing `overflow-auto` from `.wcdv-grid-table` and adding an auto-height hook that constrains the grid to viewport space so the inner scroll container activates.

---

**Steps**

### Phase 1: Fix the Scroll Container Chain
1. **Remove `overflow-auto` from `.wcdv-grid-table`** in DataGrid.tsx (~L1000) — change to `overflow-clip` (clips without creating a scroll context, so sticky passes through to the inner div)
2. **Verify the flex chain** constrains the inner scroll div when a parent has fixed height — the existing `flex-1 min-h-0` chain should work once the outer overflow is removed

### Phase 2: Auto-Height Constraint Hook
3. **Create `useAutoHeight()` hook** — new `src/components/table/useAutoHeight.ts`
   - Uses `ResizeObserver` + window resize listener
   - Measures grid's viewport offset, applies `max-height: calc(100dvh - offsetTop - bottomMargin)`
   - Minimum height clamp (200px); only activates when `stickyHeaders` is enabled
   - When parent already constrains height, the `max-height` is larger → parent wins → no interference
4. **Apply hook to `.wcdv-grid-table`** via ref in DataGrid.tsx *(depends on 3)*

### Phase 3: Visual Shadow
5. **Track `scrollTop > 0`** in `handleScroll` callback across all table types (PlainTable, GroupSummaryTable, PivotTable, GroupDetailTable)
6. **Add `.wcdv-thead-shadow` CSS** to `src/index.css` — subtle `box-shadow` when scrolled *(parallel with 5)*

### Phase 4: Demo & Test Pages
7. **Add constrained-height demo** in `src/main.tsx` — toggle or tab with `h-[500px]` wrapper
8. **Add E2E harness scenarios** in `src/testing/E2EHarnessApp.tsx` — `?e2e=sticky-viewport` and `?e2e=sticky-container` *(parallel with 7)*

### Phase 5: Automated Tests
9. **Create `tests/e2e/sticky-headers.spec.ts`** — 5 tests:
   - Headers visible after viewport scroll
   - Headers visible after container scroll
   - Shadow appears/disappears based on scroll position
   - Horizontal scroll works with sticky headers
   - `features.stickyHeaders = false` disables behavior
10. **Verify no accessibility regression** in existing a11y tests *(parallel with 9)*

---

**Relevant files**
- `src/components/DataGrid.tsx` — remove `overflow-auto` from `.wcdv-grid-table`, attach `useAutoHeight`
- `src/components/table/PlainTable.tsx` — shadow state tracking in `handleScroll`
- `src/components/table/useAutoHeight.ts` — NEW: auto-height constraint hook
- `src/components/table/GroupSummaryTable.tsx`, `PivotTable.tsx`, `GroupDetailTable.tsx` — apply shadow pattern
- `src/index.css` — add `.wcdv-thead-shadow` rule
- `src/testing/E2EHarnessApp.tsx` — add sticky test scenarios
- `tests/e2e/sticky-headers.spec.ts` — NEW: E2E tests

---

**Verification**
1. MCP browser: Navigate `http://localhost:5173/#large`, scroll down → headers stick + shadow appears
2. Constrained demo: scroll inside container → headers stick at container top
3. Wide table: scroll right → headers scroll horizontally, remain vertically stuck
4. `npx playwright test tests/e2e/sticky-headers.spec.ts` — all pass
5. `npx playwright test tests/e2e/accessibility.spec.ts` — no regressions

---

**Decisions**
- Column headers only (not toolbar/filter bar)
- Auto-detect mode (no explicit prop needed)
- CSS sticky (natural) — no header/body split panes
- `overflow-clip` on `.wcdv-grid-table` (96%+ browser support, avoids scroll context)
- Shadow indicator when floating
- `features.stickyHeaders` controls both sticky CSS and auto-height

---

**Further Considerations**
1. If content exists below the grid, `useAutoHeight` should accept a `bottomOffset` option to leave space
2. The hook should recalculate when elements above expand/collapse (ResizeObserver handles this)
3. This plan establishes the constrained scroll container that the future row-virtualization plan needs
