/**
 * Local-ui resolution for the DataVis Vite builds.
 *
 * When a sibling `@mieweb/ui` checkout is present — i.e. DataVis is being built
 * inside the ui monorepo — resolve `@mieweb/ui` from its source so DataVis
 * always tracks the local ui (no publish/symlink dance). Standalone (DataVis's
 * own CI, where `../../src` does not exist) the alias list is empty and
 * `@mieweb/ui` resolves to the published package in `node_modules`.
 *
 * The library build externalizes `@mieweb/ui`, so these aliases only affect the
 * dev server and the demo bundle.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiSrc = fileURLToPath(new URL('../../src', import.meta.url));

/** True when the sibling ui source tree is available (monorepo build). */
export function usingLocalUi() {
  return existsSync(path.join(uiSrc, 'index.ts'));
}

/** Ordered Vite aliases mapping `@mieweb/ui` subpaths to the sibling ui source. */
export function localUiAliases() {
  if (!usingLocalUi()) return [];
  // More specific patterns first; the bare `@mieweb/ui` entry must come last.
  return [
    { find: /^@mieweb\/ui\/styles\.css$/, replacement: path.join(uiSrc, 'styles/base.css') },
    { find: /^@mieweb\/ui\/utils$/, replacement: path.join(uiSrc, 'utils/index.ts') },
    { find: /^@mieweb\/ui\/datavis$/, replacement: path.join(uiSrc, 'datavis.ts') },
    { find: /^@mieweb\/ui\/components\/(.+)$/, replacement: path.join(uiSrc, 'components/$1') },
    { find: /^@mieweb\/ui$/, replacement: path.join(uiSrc, 'index.ts') },
  ];
}
