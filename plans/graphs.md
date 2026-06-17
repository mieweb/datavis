# Plan A: Graph Component

**TL;DR**: Add a reusable graph surface backed by Recharts that consumes the same normalized view data as the table layer, supports plain/grouped/pivoted outputs, and provides interactive axis controls for common business charts. Keep the internal graph model backend-agnostic so a broader chart library can be added later without changing the public API.

## Steps

### Phase 1 — Graph data model (no chart UI yet)

1. Create a graph view-model layer that converts the existing normalized outputs into chart-ready series data:
   - Plain mode — map flat rows into category + measure series based on selected x-axis, y-axis, and optional series split.
   - Grouped mode — derive categories from `groupFields` / `groupMetadata` and values from group aggregates or grouped numeric fields.
   - Pivot mode — derive x-axis values from `rowVals`, series names from `colVals`, and numeric values from the pivot matrix.
2. Keep the graph mapping logic anchored to `NormalizedViewData` from `src/adapters/wcdatavis-interop.ts` so graph rendering does not branch directly on raw legacy data structures.
3. Define graph configuration types for:
   - `chartType`
   - `xField`
   - `yFields`
   - `seriesField`
   - `stacked`
   - `aggregateKey`
   - display options such as legend / labels / empty-state behavior

### Phase 2 — Recharts renderer

4. Add a graph renderer abstraction with a narrow internal contract such as chart config + mapped series + formatting metadata.
5. Implement the first renderer adapter with Recharts, scoped to the chart families it handles well for business dashboards:
   - bar
   - line
   - area
   - composed
   - scatter
   - pie / donut
   - stacked variants of bar and area
6. Centralize chart chrome in the adapter rather than per chart type:
   - tooltip formatting
   - legend rendering
   - color palette
   - date / number formatting
   - empty / no-data states
7. Defer heatmaps and specialized chart families unless a lightweight Recharts-compatible implementation is clearly lower cost than introducing a second backend.

### Phase 3 — Controls and integration

8. Add graph state near `DataGrid.tsx` so chart selections respond to the same mode changes and view updates as the table.
9. Add interactive graph controls using existing component patterns:
   - Reuse the toolbar routing pattern from `GridToolbar.tsx` for graph-specific actions.
   - Reuse the modal structure from `ColumnConfigDialog.tsx` for axis and series selection.
   - Externalize all user-facing labels into i18n locale files.
10. Decide how the graph surface is shown in the grid experience:
   - graph-only mode
   - table / graph toggle
   - split view
   Start with the smallest viable option that does not complicate the current grid API unnecessarily.
11. Add the graph experience to the example/demo surface as part of the primary implementation, not as follow-up polish, so graph interactions can be exercised while exploring the grid table behavior.
12. Export the graph component and supporting types from the public barrels once the surface area is stable.

### Phase 4 — Stories and validation

13. Add Storybook coverage for:
   - plain chart mapping
   - grouped chart mapping
   - pivot chart mapping
   - axis-control interactions
   - chart-type switching
14. Add unit tests for the graph mapping layer so plain, grouped, and pivoted transformations can be validated without rendering charts.
15. Add Playwright smoke coverage for at least one chart scenario per output mode, plus an accessibility check.

### Phase 5 — Deferred follow-up (do not implement yet)

16. Improve grouped and pivoted graph defaults, especially around aggregate selection and multi-aggregate pivot behavior.
17. Move graph controls from the inline panel into a dedicated toolbar/dialog flow that aligns with existing GridToolbar and dialog patterns.

## Relevant Files

| File | Purpose |
|------|---------|
| `src/adapters/wcdatavis-interop.ts` | Source of the normalized plain / group / pivot data shape that graph mapping should consume |
| `src/adapters/use-data.ts` | View instance API and change events that graph state should respond to |
| `src/components/DataGrid.tsx` | Best orchestration point for graph state and surface integration |
| `src/components/GridToolbar.tsx` | Existing mode-aware toolbar routing pattern |
| `src/components/dialogs/ColumnConfigDialog.tsx` | Existing dialog pattern to reuse for axis / series configuration |
| `src/components/table/TableRenderer.tsx` | Current render router whose mode logic should be mirrored by the graph surface |
| `src/components/TableRenderer.stories.tsx` | Existing fixtures for plain / group / pivot output states |
| `src/demo/` | Example/demo data and grid entry points that should expose the graph surface for interactive exploration |
| `src/testing/E2EHarnessApp.tsx` | E2E harness entry point for graph scenarios |
| `src/testing/LegacyScenarioViews.tsx` | Existing lightweight chart-oriented scenario, useful only as a UX reference |
| `src/components/index.ts` | Component barrel for graph exports |
| `src/index.ts` | Package root exports |
| `src/i18n/en-US.json` | Initial locale file for new graph labels |
| `package.json` | Dependency and packaging surface for Recharts |

## Verification

1. Add mapper unit tests for representative plain, grouped, and pivoted inputs.
2. Run `npm test` for mapper coverage and adjacent graph utilities.
3. Run `npm run typecheck` to verify chart-library typings and public exports.
4. Run `npm run lint` and `npm run lint:i18n` to ensure new graph labels are externalized and the touched files remain clean.
5. Verify the example/demo experience exposes the graph UI alongside the grid so chart controls and table behavior can be exercised together by hand.
6. Verify Storybook scenarios for axis selection, chart-type switching, empty states, grouped legends, and pivot defaults.
7. Run Playwright smoke coverage for one chart per mode and an accessibility pass.

## Decisions

- Use Recharts for v1 because it gives the shortest path to a usable React-native graph component in this library.
- Keep the graph API backend-agnostic internally so a second renderer can be added later without breaking consumers.
- Focus the first release on common business charts rather than trying to satisfy the full long-tail of chart types.
- Treat example/demo integration as required scope so developers can interact with graphs while evaluating the grid table.
- Default pivot visuals to a single aggregate at a time until multi-measure pivot chart UX is proven.
- Exclude maps, 3D, sankey/network, advanced heatmaps, and specialized statistical visuals from v1.

## Future Considerations

1. If chart requirements expand past Recharts’ strengths, add a second adapter for Apache ECharts rather than overloading the v1 implementation.
2. If the graph surface becomes a core workflow, consider a stable persisted graph configuration model so perspectives can save chart selections alongside table state.
3. If users need drilldown from charts into rows, wire that behavior through the existing view/filter/group state instead of building a separate chart-specific data pipeline.