# @mieweb/ui Migration Checklist

## Goal

Convert remaining internally rendered native UI controls and custom interaction surfaces to `@mieweb/ui` components or approved wrappers built on top of `@mieweb/ui` patterns.

## Scope

This checklist covers:

- Production UI in `src/components/**`
- Demo shell UI in `src/main.tsx`
- Storybook scaffolding and testing harness controls that should eventually match the same design system

This checklist does not assume that every current native element has a one-to-one `@mieweb/ui` replacement. Where the library does not expose a matching primitive, the migration target should be:

- an `@mieweb/ui` component directly, or
- a small local wrapper that composes approved `@mieweb/ui` primitives and preserves the existing behavior

## Success Criteria

- [ ] No production-facing native `button`, `select`, `input`, or `textarea` elements remain unless there is a documented exception.
- [ ] Reusable controls use `@mieweb/ui` directly instead of ad hoc Tailwind-only styling.
- [ ] Keyboard behavior, focus management, ARIA labels, and existing interaction behavior remain intact.
- [ ] Demo, story, and E2E-only controls are either migrated too or explicitly documented as intentional exceptions.
- [ ] Lint, build, and relevant tests pass after the migration.

## Recommended Order

- [ ] Migrate low-risk standalone controls first.
- [ ] Migrate filter controls next.
- [ ] Migrate table controls and menus after that.
- [ ] Migrate demo, stories, and test harness controls last.

## Phase 1: Establish Target Mappings

- [x] Confirm the canonical `@mieweb/ui` replacements for these native elements:
  - `button` -> `@mieweb/ui/components/Button`
  - `select` -> `@mieweb/ui/components/Select`
  - text-like `input` -> `@mieweb/ui/components/Input`
  - date entry -> prefer native date-capable input styling via `Input`; use `DateInput` only where `MM/DD/YYYY` formatting is acceptable
  - contextual menu / dropdown menu items -> `@mieweb/ui/components/Dropdown` + `DropdownItem`
  - tab triggers -> `@mieweb/ui/components/Tabs`
  - sortable table primitives -> `@mieweb/ui/components/Table`
- [x] Document any missing primitives from `@mieweb/ui` and decide whether to:
  - add a local wrapper in a shared UI layer, or
  - keep a native element with an explicit exception note
  - Result: no dedicated accordion or disclosure primitive was found, so disclosure-style interactions should use a local wrapper built on `Button` until the library grows a first-class component.
- [x] Define consistent variants for icon-only actions, inline text actions, menu items, and compact table controls.
  - Implemented shared wrappers in `src/components/ui/`:
    - `IconButton`
    - `InlineActionButton`
    - `TableActionButton`
    - `DisclosureButton`
    - `MenuAction`

### Confirmed Phase 1 Decisions

- [x] Use `Dropdown` and `DropdownItem` as the standard target for custom action menus.
- [x] Use `Tabs`, `TabsList`, and `TabsTrigger` as the standard target for tab bars such as the demo shell.
- [x] Do not use `DateInput` for current filter date fields unless the UX is intentionally changed to `MM/DD/YYYY`; keep native picker semantics for filter date and datetime controls.
- [x] Prefer local wrappers in `src/components/ui/` when the same compact action pattern appears in multiple migration targets.

## Phase 2: Migrate Standalone Production Controls

### Detail Panel

- [x] [src/components/DetailSlider.tsx](src/components/DetailSlider.tsx)
  - Replace the native close button with an `@mieweb/ui` button variant appropriate for icon-only dismissal.
  - Preserve first-focus and Escape-close behavior.

### Title Bar

- [x] [src/components/TitleBar.tsx](src/components/TitleBar.tsx)
  - Replace the native `Clear Filter` action with an `@mieweb/ui` button or text-link styled action.
  - Keep the current inline status layout and ARIA label.

### Preferences Toolbar

- [x] [src/components/toolbars/PrefsToolbar.tsx](src/components/toolbars/PrefsToolbar.tsx)
  - Replace the native perspective `<select>` with an `@mieweb/ui` select.
  - Preserve the `__NEW__` option flow for creating perspectives.
  - Verify unsaved indicators such as `[*]` remain visible or get a better design-system representation.

### Debug Dialog

- [ ] [src/components/dialogs/DebugDialog.tsx](src/components/dialogs/DebugDialog.tsx)
  - Replace collapsible section header buttons with an `@mieweb/ui` accordion, disclosure, or button pattern.
  - Preserve section toggle state and `aria-expanded` behavior.

## Phase 3: Migrate Filter Controls

### Operator Select

- [x] [src/components/filters/FilterOperatorSelect.tsx](src/components/filters/FilterOperatorSelect.tsx)
  - Replace the native `<select>` with an `@mieweb/ui` select.
  - Preserve auto-focus behavior.
  - Preserve the current "focus next value element" behavior after selection.
  - Re-test date-picker opening and multiselect trigger opening after operator changes.

### Date Filter Inputs

- [x] [src/components/filters/DateFilter.tsx](src/components/filters/DateFilter.tsx)
  - Replace native date and datetime inputs with `@mieweb/ui` input components if they support those types.
  - If `@mieweb/ui` input does not support date or datetime behavior well enough, create a thin wrapper using the library input styling while preserving native picker behavior.
  - Re-test auto-focus from start date to end date.
  - Re-test `showPicker()` behavior where supported.

### String Filter Multiselect Surface

- [x] [src/components/filters/StringFilter.tsx](src/components/filters/StringFilter.tsx)
  - Replace the internal search input with an `@mieweb/ui` input.
  - Replace the `All` and `None` native buttons with compact `@mieweb/ui` buttons or text-action variants.
  - Keep the custom multiselect listbox behavior unless `@mieweb/ui` provides a suitable multiselect primitive.
  - Verify keyboard support, outside click close, and Escape handling still work.

### Filter Bar Micro-Actions

- [x] [src/components/filters/FilterBar.tsx](src/components/filters/FilterBar.tsx)
  - Replace the remove-filter button with an `@mieweb/ui` icon button.
  - Replace the `Add field…` trigger with an `@mieweb/ui` button or dropdown trigger.
  - Replace addable-field menu item buttons with `@mieweb/ui` menu actions if available.
  - If the library lacks a menu primitive, introduce a shared wrapper rather than keeping bespoke buttons here.

## Phase 4: Migrate Table Controls

### Plain Table Header And Footer Actions

- [x] [src/components/table/PlainTable.tsx](src/components/table/PlainTable.tsx)
  - Replace the sortable header button with an `@mieweb/ui` button pattern that still feels like a table header control.
  - Replace the filter icon button with an `@mieweb/ui` icon button.
  - Replace footer `Show More` and `Show All` buttons with `@mieweb/ui` buttons.
  - Preserve drag, resize, sort, and filter interactions.
  - Confirm header buttons still do not disrupt DnD and resize behavior.

### Group Detail Table

- [x] [src/components/table/GroupDetailTable.tsx](src/components/table/GroupDetailTable.tsx)
  - Replace the expand/collapse-all button with an `@mieweb/ui` icon button.
  - Replace sortable group header buttons with `@mieweb/ui` button patterns suitable for table headers.
  - Replace footer `Show More` and `Show All` buttons with `@mieweb/ui` buttons.
  - Verify grouped sorting, expand/collapse, and footer pagination behavior remain unchanged.

### Header Context Menu

- [x] [src/components/table/HeaderContextMenu.tsx](src/components/table/HeaderContextMenu.tsx)
  - Replace native menu item buttons with `@mieweb/ui` menu primitives if they exist.
  - If no menu primitive exists, create a shared wrapper aligned with `@mieweb/ui` styling and interaction conventions.
  - Preserve submenu behavior, checked states, disabled states, and close-on-select behavior.
  - Re-test viewport positioning and keyboard dismissal.

## Phase 5: Migrate Dialog Table Inline Actions

### Column Config Dialog

- [x] [src/components/dialogs/ColumnConfigDialog.tsx](src/components/dialogs/ColumnConfigDialog.tsx)
  - Replace rename, move-to-top, and move-to-bottom native buttons with compact `@mieweb/ui` icon buttons.
  - Keep tooltip behavior intact.
  - Preserve row layout density so the dialog remains usable for many columns.

## Phase 6: Migrate Demo Shell, Stories, And Test Harness

These files are lower priority than production UI, but migrating them will keep the design system consistent and reduce future drift.

### Demo Shell

- [ ] [src/main.tsx](src/main.tsx)
  - Replace demo tab buttons with `@mieweb/ui` tabs if appropriate, or buttons using design-system styling.
  - Preserve tab semantics and current visual active state.

### Storybook Controls

- [ ] [src/components/DetailSlider.stories.tsx](src/components/DetailSlider.stories.tsx)
  - Replace the story-only launch button with `@mieweb/ui` Button.
- [ ] [src/components/TableRenderer.stories.tsx](src/components/TableRenderer.stories.tsx)
  - Replace story-only progress adjustment buttons with `@mieweb/ui` Button.

### Testing Harness / Legacy Scenarios

- [ ] [src/testing/LegacyScenarioViews.tsx](src/testing/LegacyScenarioViews.tsx)
  - Replace scenario buttons, selects, and inputs with `@mieweb/ui` components where practical.
  - Keep E2E selectors and ARIA labels stable where tests depend on them.
  - Decide whether native controls are acceptable here for intentionally lightweight harnesses; if yes, document the exception.

## Cross-Cutting Refactors

- [ ] Introduce shared compact action primitives if the same migration pattern appears in multiple places.
- [ ] Introduce a shared menu abstraction if both filter menus and header context menus need the same `@mieweb/ui` composition.
- [ ] Introduce shared table-action button variants for sort, filter, expand, and pagination controls.
- [ ] Remove duplicated Tailwind-only button and input styling once components are migrated.

## Validation Checklist

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run the relevant Storybook stories or local demo flows for migrated areas.
- [ ] Run relevant E2E coverage for filters, tables, dialogs, and preference management.
- [ ] Verify keyboard navigation for:
  - filter operator changes
  - date input focus transitions
  - context menus
  - table sorting controls
  - dialog inline actions
- [ ] Verify screen-reader labels still describe icon-only controls clearly.
- [ ] Verify all user-facing text remains externalized for i18n.

## Suggested Execution Plan

- [x] Batch 1: `DetailSlider`, `TitleBar`, `PrefsToolbar`, `ColumnConfigDialog`
- [x] Batch 2: `FilterOperatorSelect`, `DateFilter`, `StringFilter`, `FilterBar`
- [x] Batch 3: `PlainTable`, `GroupDetailTable`, `HeaderContextMenu`
- [x] Batch 4: `DebugDialog`, `src/main.tsx`, stories, and `LegacyScenarioViews`

## Notes

- Prefer the smallest viable change in each file.
- Avoid changing interaction behavior and visual density at the same time unless required by the library.
- Where `@mieweb/ui` lacks a direct equivalent, create one reusable wrapper rather than repeating custom styling in each component.