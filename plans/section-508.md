# Plan: Section 508 Accessibility + i18n Improvements

## TL;DR
The DataGrid codebase has a moderate a11y foundation (ARIA on toolbars/tables/dialogs, translated aria-labels, skip link, keyboard nav hook, eslint-plugin-jsx-a11y). Major gaps remain: missing form semantics, table scope/caption, landmark regions, focus management in dialogs, aria-describedby/aria-selected, automated a11y testing, and RTL layout support. This plan addresses all Section 508 / WCAG 2.1 AA requirements across 6 phases while preserving and extending the existing i18n system.

---

## Phase 1: Landmark Regions & Page Structure

**Goal:** Establish proper document structure so assistive tech can navigate by landmark.

1. Wrap `DataGrid` top-level in a `<main>` or add `role="main"` to the region container in `DataGrid.tsx` (~L884)
2. Change `TitleBar` wrapper from `role="banner"` div to semantic `<header>` element
3. Wrap `ControlPanel` in `<aside>` or `<nav>` with `aria-label={t('CONTROL.PANEL_LABEL')}`
4. Add `role="contentinfo"` or `<footer>` to any footer-like region (pagination area)
5. Add new i18n keys: `GRID.LANDMARK.MAIN`, `GRID.LANDMARK.CONTROLS`, `GRID.LANDMARK.TABLE_REGION`

**Files:**
- `src/components/DataGrid.tsx` — region wrapper, skip link target
- `src/components/TitleBar.tsx` — switch to `<header>`
- `src/components/controls/ControlPanel.tsx` — add `<aside>` or nav landmark
- `src/i18n/en-US.json` — new landmark label keys

---

## Phase 2: Table Semantics & State

**Goal:** Make all 4 table renderers fully Section 508 compliant for data tables.

1. Add `scope="col"` to all `<th>` with `role="columnheader"` across all table components
2. Add `scope="row"` to row header `<th>` elements in `PivotTable`
3. Add `<caption>` element to each `<table>` — use translated grid title or a descriptive summary; add i18n key `TABLE.CAPTION` with `{{param0}}` for table name
4. Add `aria-colcount={columns.length}` on each `<table>` element
5. Add `aria-selected={isSelected}` to `<tr>` elements in `PlainTable` when row selection is active
6. Add `aria-describedby` linking complex multi-level header structures to a hidden description element explaining the aggregate layout
7. Verify `aria-rowcount` and `aria-rowindex` are correct (1-based) — already present, audit values

**Files:**
- `src/components/table/GroupSummaryTable.tsx` — scope, caption, colcount
- `src/components/table/GroupDetailTable.tsx` — scope, caption, colcount, aria-selected
- `src/components/table/PivotTable.tsx` — scope="row", caption, colcount
- `src/components/table/PlainTable.tsx` — scope, caption, colcount, aria-selected
- `src/i18n/en-US.json` — new TABLE.CAPTION key

---

## Phase 3: Form Accessibility

**Goal:** All filter and control inputs meet WCAG 2.1 AA form requirements.

1. Wrap `FilterBar` content in a `<form>` element with `role="search"` and `aria-label={t('FILTER.FORM_LABEL')}`, prevent default submit
2. Group related filter controls within `<fieldset>` + `<legend>` (e.g., each column filter group)
3. Replace `hideLabel` pattern with visible or properly associated `<label htmlFor={id}>` elements on all `Input` components in filters — if design requires hidden labels, use `sr-only` class on `<label>` instead of `aria-label` on input
4. Add `aria-describedby` for filter operator explanations — create hidden helper text per operator type
5. Add `aria-required="true"` where filter values are mandatory for the filter to activate
6. Add `aria-invalid="true"` + `aria-describedby` error message pattern for invalid filter values
7. Add i18n keys: `FILTER.FORM_LABEL`, `FILTER.OPERATOR_HELP.*` (one per operator category), `FILTER.ERROR.INVALID_VALUE`, `FILTER.ERROR.REQUIRED`

**Files:**
- `src/components/filters/FilterBar.tsx` — form wrapper, fieldset
- `src/components/filters/StringFilter.tsx` — label association, describedby
- `src/components/filters/NumberFilter.tsx` — label association, describedby
- `src/components/filters/DateFilter.tsx` — label association, describedby
- `src/components/filters/BooleanFilter.tsx` — verify label association (already good)
- `src/components/filters/FilterOperatorSelect.tsx` — describedby help text
- `src/components/controls/ControlSection.tsx` — fieldset/legend for group/pivot sections
- `src/components/controls/AggregateSection.tsx` — fieldset/legend
- `src/i18n/en-US.json` — new form/filter keys

---

## Phase 4: Focus Management & Keyboard Navigation

**Goal:** Full keyboard operability for all interactive patterns.

1. **Dialog focus traps:** Verify all 6 dialogs (ColumnConfigDialog, DebugDialog, GridTableOptionsDialog, GroupFunctionDialog, PerspectiveManagerDialog, TemplateEditorDialog) properly trap focus. If `@mieweb/ui` Modal already handles this, verify; if not, add focus-trap-react or equivalent
2. **Focus return:** Store `document.activeElement` before dialog open, restore focus to trigger element on close — implement as a shared `useFocusReturn()` hook
3. **FilterBar focus:** When a new filter is added, auto-focus the operator select or first input of the new filter row
4. **Roving tabindex in toolbars:** Implement roving tabindex pattern for `role="toolbar"` containers (TitleBar, GridToolbar, OperationsPalette) — only one item in toolbar receives tab, arrow keys move between items
5. **Keyboard shortcuts documentation:** Add a `aria-keyshortcuts` attribute or a discoverable help overlay listing shortcuts (j/k navigation, Enter/Space to activate, Escape to deselect, etc.)
6. **Visible focus indicators:** Audit all interactive elements for `focus-visible` ring styles — Tailwind's `focus-visible:ring-2 focus-visible:ring-offset-2` pattern. Ensure custom buttons in `ui/actions.tsx` have consistent focus rings
7. **HeaderContextMenu keyboard:** Ensure column header context menu can be opened via keyboard (Shift+F10 or dedicated button) — not just right-click
8. Add i18n key: `GRID.KEYBOARD_HELP` for shortcuts overlay

**Files:**
- `src/components/dialogs/*.tsx` — all 6 dialogs, focus trap verification
- `src/components/ui/actions.tsx` — focus ring styles on IconButton, InlineActionButton, etc.
- `src/components/TitleBar.tsx` — roving tabindex
- `src/components/GridToolbar.tsx` — roving tabindex
- `src/components/OperationsPalette.tsx` — roving tabindex
- `src/components/filters/FilterBar.tsx` — auto-focus new filters
- `src/components/table/HeaderContextMenu.tsx` — keyboard trigger
- New: `src/components/table/useRovingTabindex.ts` — reusable roving tabindex hook
- New: `src/components/table/useFocusReturn.ts` — reusable focus return hook

---

## Phase 5: RTL & i18n Enhancement

**Goal:** Support RTL locales and close remaining i18n gaps.

1. **RTL direction detection:** Add `dir` attribute to DataGrid root element based on current locale. Create a `useDirection()` hook that returns `'rtl'` or `'ltr'` based on locale code
2. **RTL-aware layout:** Audit all Tailwind classes using directional values (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`) and replace with logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`)
3. **Icon flipping:** Chevron icons should auto-flip in RTL — add `rtl:rotate-180` class or use CSS logical properties
4. **DetailSlider RTL:** Slider currently slides from right — should slide from left in RTL contexts. Update transform classes
5. **Pinned columns RTL:** Frozen columns pin to left — should pin to right in RTL. Update sticky positioning logic
6. **Add Arabic locale:** Add `ar-SA` locale to `SUPPORTED_LOCALES` and create `src/i18n/locales/ar-SA.json` translation file (initially with key stubs)
7. **i18n key audit:** Run `npm run lint:i18n` to verify all new keys from Phases 1-4 are registered in en-US.json, then propagate stub keys to all 10 locale files
8. Add i18n key: `LANG.DIRECTION` (value: "ltr" or "rtl" per locale — or detect programmatically from Intl)

**Files:**
- `src/components/DataGrid.tsx` — dir attribute
- New: `src/hooks/useDirection.ts` — RTL detection hook
- `src/components/DetailSlider.tsx` — RTL slide direction
- `src/components/table/*.tsx` — all tables, logical properties for pinned columns
- `src/components/ui/icons.tsx` — RTL icon flip
- `src/components/LanguageSelector.tsx` — add Arabic locale
- `src/i18n/en-US.json` — all new keys
- New: `src/i18n/locales/ar-SA.json` — Arabic locale file
- All other locale files in `src/i18n/locales/` — stub new keys

---

## Phase 6: Automated Accessibility Testing

**Goal:** Prevent regressions with automated a11y scanning.

1. **Install axe-playwright:** Add `@axe-core/playwright` as a dev dependency
2. **Create a11y test suite:** New file `tests/e2e/accessibility.spec.ts` with axe scans of key views:
   - Plain table view
   - Grouped table view
   - Pivot table view
   - Filter bar open with active filters
   - ColumnConfigDialog open
   - DetailSlider open
3. **Axe rule configuration:** Disable rules that conflict with intentional patterns (e.g., `color-contrast` if unable to control host page), tag with WCAG 2.1 AA
4. **Add a11y checks to existing E2E tests:** Add `await checkA11y(page)` helper to `tests/e2e/helpers.ts`
5. **ESLint enhancement:** Verify `eslint-plugin-jsx-a11y` strict mode or add custom rules for:
   - Require `scope` on `<th>` elements
   - Require `<caption>` in `<table>`
   - Require `aria-describedby` on form inputs with errors

**Files:**
- `package.json` — add `@axe-core/playwright`
- New: `tests/e2e/accessibility.spec.ts` — axe-based a11y test suite
- `tests/e2e/helpers.ts` — shared `checkA11y()` helper
- `eslint.config.js` — stricter jsx-a11y rules
- `playwright.config.ts` — verify test inclusion

---

## Verification

1. **Lint pass:** `npm run lint` — zero new warnings/errors from jsx-a11y
2. **i18n key check:** `npm run lint:i18n` — all new keys present in en-US.json
3. **Axe scan pass:** `npx playwright test tests/e2e/accessibility.spec.ts` — zero WCAG 2.1 AA violations
4. **Existing E2E pass:** `npx playwright test` — no regressions in legacy/core/extended tests
5. **Screen reader manual test:** Navigate full DataGrid workflow using VoiceOver (macOS) — verify landmarks, table headers, form labels, dialog flow, live region announcements
6. **Keyboard-only test:** Complete full workflow (filter, sort, group, pivot, column config, export) using only keyboard — verify focus visibility and logical tab order
7. **RTL visual test:** Switch to Arabic locale and verify layout mirrors correctly (DetailSlider, pinned columns, toolbars, icons)

---

## Decisions

- **Label strategy:** Use `sr-only` `<label>` elements over `aria-label` on inputs — better assistive tech support and consistent with `<label htmlFor>` pattern
- **Focus trap implementation:** Prefer verifying `@mieweb/ui` Modal's built-in focus trap before adding a new dependency
- **RTL approach:** Tailwind logical properties (`ms-`/`me-`/`ps-`/`pe-`) over manual conditional classes — cleaner, DRY
- **Scope:** Production code only — Storybook stories and test fixtures with hardcoded strings are excluded from i18n remediation
- **WCAG target:** 2.1 AA (Section 508 refresh aligns with WCAG 2.0 AA minimum; targeting 2.1 AA for best practice)

## Further Considerations

1. **@mieweb/ui library audit:** Several a11y fixes depend on @mieweb/ui component internals (Modal focus trap, Input label rendering, Select keyboard nav). If @mieweb/ui doesn't support required patterns, fixes may need to be contributed upstream or worked around locally. *Recommend: audit @mieweb/ui components first in Phase 4.*
2. **Color contrast:** No contrast audit is included in this plan since the app uses Tailwind defaults and @mieweb/ui theming. A separate contrast audit with a tool like Colour Contrast Analyser may be warranted if custom colors are used. *Recommend: include in Phase 6 axe scan which checks contrast automatically.*
3. **Parallel execution:** Phases 1-3 can proceed in parallel since they touch mostly different files. Phase 4 depends partially on Phase 3 (form focus). Phase 5 (RTL) is independent of Phases 1-4. Phase 6 should run last to validate everything.
