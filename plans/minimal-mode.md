# Plan: DataGrid Minimal Mode

## Status

- [x] **Step 1** — Extract `TitleBarActions` (collapse optional) from `TitleBar`.
      New file `src/components/TitleBarActions.tsx`; `TitleBar` now renders it.
- [x] **Step 2** — Add `layout?: 'inline' | 'stacked'` to `PrefsToolbar`. Stacked
      puts the perspective `Select` on its own row and the buttons beneath.
- [x] **Step 3** — Add `minimalMode?: boolean` to `DataGridProps` + destructuring.
- [x] **Step 4** — New `src/components/MinimalMenu.tsx` (floating lucide `Ellipsis`
      button + Dropdown menu: `TitleBarActions` row, then stacked `PrefsToolbar`).
- [x] **Step 5** — `DataGrid` renders `MinimalMenu` instead of `TitleBar` when
      `minimalMode`; root gets `relative` for overlay positioning.
- [x] **Step 6** — Demo: "Minimal mode" checkbox in `main.tsx` header, threaded
      through `GridDemo` to every grid.
- [x] **Verify** — `tsc --noEmit` passes; eslint clean on all changed files (2
      pre-existing errors remain in untouched `PlainTable.tsx`). Manual visual
      check at localhost:5173 still recommended.

## Goal

Add a `minimalMode` flag to `DataGrid` that **removes the TitleBar** and replaces
it with a floating, semi-transparent **ellipsis button** overlaid on the grid. The
button is partially transparent by default and becomes fully opaque on hover.
Clicking it opens a menu containing the options that normally live in the title bar
(download, copy, refresh, show controls), plus the perspective dropdown and its
buttons. The control panels (filter/group/pivot/aggregate) and the data table
render **identically** to normal mode.

## Menu layout (top → bottom)

- **Row 1 — titlebar actions:** download, copy, refresh, show controls
  (collapse/expand is **excluded** — see Decisions).
- **Row 2 — perspective dropdown:** the perspective `Select`.
- **Row 3 — perspective buttons:** reset, back/forward, save as, save, rename,
  delete.

## Key files

- **`src/components/DataGrid.tsx`** — add `minimalMode?: boolean` to `DataGridProps`
  (~line 215). In the render (`.wcdv-grid` root, ~line 1116): when `minimalMode`,
  skip `<TitleBar>` and render the `MinimalMenu` overlay positioned absolutely
  (top-right) inside the root so it persists. Reuse the handlers already wired to
  `TitleBar` (`handleExportCsv`, `handleCopyClipboard`, `handleRefresh`,
  `handleToggleControls`, `openPerspective`, `clearFilter`; lines ~1124–1142).
- **`src/components/TitleBar.tsx`** — extract the action-button cluster
  (download/copy/refresh/settings/collapse, lines ~129–194) into a new
  `TitleBarActions` component for DRY reuse in both `TitleBar` and the minimal menu.
  Make the collapse button **optional** (e.g. a `showCollapse` prop) so `TitleBar`
  keeps it but `MinimalMenu` omits it.
- **`src/components/toolbars/PrefsToolbar.tsx`** — add a `layout?: 'inline' |
  'stacked'` prop. `'inline'` (default) keeps the current single-row titlebar
  behavior. `'stacked'` renders the perspective `Select` on its own row and the
  perspective buttons (reset/back/forward/save-as/save/rename/delete) on the row
  beneath. Keeps `usePrefs`/rename state in one component (DRY). Note: contains a
  nested `Dropdown` (rename).
- **NEW `src/components/MinimalMenu.tsx`** — wraps `@mieweb/ui` `Dropdown` +
  `DropdownContent`; trigger = floating ellipsis `Button` (lucide `Ellipsis` /
  `MoreHorizontal`), placement `bottom-end`. Body rows:
  - Row 1: `<TitleBarActions showCollapse={false} … />`
  - Rows 2–3: `<PrefsToolbar layout="stacked" … />`

## Steps

1. Extract `TitleBarActions` from `TitleBar.tsx`, with the collapse button optional.
   `TitleBar` renders it (behavior unchanged). *(blocks step 4)*
2. Add the `layout?: 'inline' | 'stacked'` prop to `PrefsToolbar.tsx`. *(blocks
   step 4)*
3. Add `minimalMode?: boolean` to `DataGridProps`. *(parallel with 1, 2)*
4. Create `src/components/MinimalMenu.tsx` (ellipsis trigger + the three-row menu).
   *(depends on 1, 2)*
5. In `DataGrid` render: when `minimalMode`, skip `<TitleBar>` and render the
   `MinimalMenu` overlay (absolute, top-right) inside `.wcdv-grid`, wiring the
   existing handlers. *(depends on 3, 4)*
6. Add a minimal-mode demo toggle in `src/main.tsx` (~line 295) for visual
   verification.

## Styling

- Tailwind inline (this folder uses Tailwind, not SCSS).
- lucide icons directly (no `ui` icon wrappers).
- Ellipsis button: `absolute right-2 top-2 z-20 opacity-40 hover:opacity-100
  transition-opacity`, ghost `Button` variant.
- Accessibility: `aria-label` and `aria-haspopup="menu"` on the trigger.

## Decisions

- **Collapse/expand: EXCLUDED** from the minimal menu — nothing remains visible
  after collapsing, so there would be no way to expand again. `TitleBarActions`
  makes the collapse button optional so `TitleBar` keeps it and `MinimalMenu` omits
  it.
- **`minimalMode` flag location:** `DataGridProps` boolean (recommended) rather than
  a `tableDef` feature flag.

## Open consideration

- Nested `Dropdown` (PrefsToolbar rename) inside the menu `Dropdown` — verify nested
  behavior during implementation; if it misbehaves, fall back to a custom popover for
  the menu.

## Verification

- Add a story/demo with `minimalMode`; visual check at `http://localhost:5173/`.
- Ellipsis ~40% opaque, full opacity on hover; menu opens showing the action row
  (no collapse), the perspective dropdown row, and the perspective-buttons row.
- Actions work: download / copy / refresh / show controls / perspective switch.
- Control panels and table look identical to normal mode.
- Keyboard: tab to ellipsis → Enter opens → Esc closes; aria labels present.
- Run `npm` lint + build.
