# wcdatavis-lib

Vendored subset of [`@mieweb/wcdatavis`](https://github.com/mieweb/wcdatavis) (commit `8219021`).

This directory contains the data-processing engine files needed by DataVis NITRO.
UI-only modules (Grid, Graph, renderers, toolbars, filters) are replaced with
empty stubs since the React UI in `src/` replaces them entirely.

## What's used

| Symbol | From | Used in |
|---|---|---|
| `Source` | `src/source.js` | `adapters/wcdatavis-interop.ts`, `demo/mock-grid.ts` |
| `ComputedView` | `src/computed_view.js` | `demo/mock-grid.ts` |
| `AGGREGATE_REGISTRY` | `src/aggregates.js` | `adapters/wcdatavis-interop.ts` |
| `AggregateInfo` | `src/aggregates.js` | `adapters/wcdatavis-interop.ts` |

## Updating

To update from a newer wcdatavis commit:

1. Clone / checkout the desired commit of `mieweb/wcdatavis`
2. Copy `src/`, `wcdatavis.css`, and `global-jquery.js` into this directory  
3. Re-apply the stubs (grid.js, graph.js, perspective.js, etc.)
4. Test: `npx vite build --config vite.demo.config.ts`
