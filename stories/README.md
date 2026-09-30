# DataVis NITRO stories

Storybook stories for the DataVis NITRO grid, graph, and demos. They import the
public `@mieweb/datavis` API exactly as a consumer would.

These stories are **authored here** but **rendered by the top-level `@mieweb/ui`
Storybook**, which globs this folder (see `.storybook/main.ts` in the `ui`
repo). The catalog hierarchy is fixed by each story's `id` / `title`
(`Components/Grids/DataVis NITRO*`) and its `catalog` parameters — keep those
unchanged so the `ui` catalog crosslinks and grouping stay intact.

| File | Story id | Title |
| --- | --- | --- |
| `DataVisNITRO.stories.tsx` | `grids-datavis-nitro` | Components/Grids/DataVis NITRO |
| `DataVisNITRO.demo.stories.tsx` | `grids-datavis-nitro-demos` | Components/Grids/DataVis NITRO Demos |
| `DataVisNitroGraph.stories.tsx` | `grids-datavis-nitro-graph` | Components/Grids/DataVis NITRO Graph |
| `DataVisChat.stories.tsx` | `grids-datavis-chat` | Components/Grids/DataVis Chat |

Sample datasets (`/sample-data.json`, `/sample-graph-data.json`) are served from
the top-level Storybook's `public/` directory.
