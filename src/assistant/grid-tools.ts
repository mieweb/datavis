/**
 * Grid assistant tools — the pure, testable command surface the "Hey Ozwell"
 * assistant uses to manipulate a grid.
 *
 * Each tool maps a validated parameter payload onto the imperative
 * `ViewInstance` / `PrefsInstance` APIs. Tools never touch React state
 * directly; UI sync happens via the `assistantSpecChange` event fired on the
 * view after every mutation (DataGrid subscribes to it).
 */

import type { ViewInstance } from '../adapters/use-data';
import type { PrefsInstance, PerspectiveInfo } from '../adapters/use-prefs';
import { buildGroupSpec, GROUP_FUNCTION_ALLOWED_TYPES } from '../adapters/group-adapter';
import { toLegacyAggregateSpec } from '../adapters/wcdatavis-interop';
import type { FilterOperator } from '../components/filters/types';

// ───────────────────────────────────────────────────────────
// Context & result types
// ───────────────────────────────────────────────────────────

/** Column metadata the assistant needs for validation and prompting. */
export interface GridAssistantColumn {
  field: string;
  header: string;
  /** Field type (string | number | currency | date | datetime | time | boolean) */
  type?: string;
}

/** Everything a tool needs to act on the grid. */
export interface GridToolContext {
  view: ViewInstance;
  prefs?: PrefsInstance;
  columns: GridAssistantColumn[];
  /**
   * Optional host override for global search; pass '' to clear. When omitted,
   * the ASSISTANT_GLOBAL_SEARCH_EVENT view event is fired instead (DataGrid
   * subscribes to it).
   */
  setGlobalSearch?: (query: string) => void;
}

/** Result of a tool execution. */
export interface GridToolResult {
  ok: boolean;
  /** Human-readable outcome, fed back to the LLM and shown in the UI. */
  summary: string;
  /** Structured payload (state snapshots, row samples, …). */
  data?: unknown;
}

/** Parameter documentation for prompting and UI display. */
export interface GridToolParameterDef {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

/** A tool definition: metadata + executor. */
export interface GridToolDefinition {
  name: string;
  description: string;
  parameters: GridToolParameterDef[];
  execute: (ctx: GridToolContext, params: Record<string, unknown>) => Promise<GridToolResult> | GridToolResult;
}

/** Event fired on the view after any assistant-driven spec mutation. */
export const ASSISTANT_SPEC_CHANGE_EVENT = 'assistantSpecChange';

/** Event fired on the view when the assistant sets the global search query ('' clears). */
export const ASSISTANT_GLOBAL_SEARCH_EVENT = 'assistantGlobalSearch';

/**
 * datavis-ace emitters only accept events declared on the constructor's
 * `events` allowlist. Idempotently add the assistant events so `on`/`fire`
 * work on any view instance.
 */
export function registerAssistantEvents(view: ViewInstance): void {
  const ctor = (view as { constructor?: { events?: Record<string, string> } }).constructor;
  if (!ctor?.events) return;
  for (const evt of [ASSISTANT_SPEC_CHANGE_EVENT, ASSISTANT_GLOBAL_SEARCH_EVENT]) {
    if (ctor.events[evt] === undefined) ctor.events[evt] = evt;
  }
}

// ───────────────────────────────────────────────────────────
// Validation helpers
// ───────────────────────────────────────────────────────────

const FILTER_OPERATORS: ReadonlySet<string> = new Set<FilterOperator>([
  '$contains', '$notcontains', '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$exists', '$notexists', '$bet', '$every', '$this', '$last',
]);

const MAX_DATA_SAMPLE_ROWS = 50;

function fail(summary: string): GridToolResult {
  return { ok: false, summary };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate that every field exists on the grid; returns an error message or null. */
function validateFields(ctx: GridToolContext, fields: string[]): string | null {
  const known = new Set(ctx.columns.map((c) => c.field));
  const unknown = fields.filter((f) => !known.has(f));
  if (unknown.length === 0) return null;
  return `Unknown field(s): ${unknown.join(', ')}. Available fields: ${ctx.columns.map((c) => c.field).join(', ')}`;
}

/** Notify the host UI that the assistant changed the view spec. */
function fireSpecChange(ctx: GridToolContext): void {
  registerAssistantEvents(ctx.view);
  ctx.view.fire(ASSISTANT_SPEC_CHANGE_EVENT);
}

/** Set the global search query via the host callback or the view event bridge. */
function applyGlobalSearch(ctx: GridToolContext, query: string): void {
  if (ctx.setGlobalSearch) {
    ctx.setGlobalSearch(query);
  } else {
    registerAssistantEvents(ctx.view);
    // datavis-ace fire() signature is (event, opts, ...handlerArgs).
    ctx.view.fire(ASSISTANT_GLOBAL_SEARCH_EVENT, {}, query);
  }
}

function parseFieldList(value: unknown): Array<{ field: string; fun?: string }> | null {
  if (!Array.isArray(value)) return null;
  const out: Array<{ field: string; fun?: string }> = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      out.push({ field: entry });
    } else if (isRecord(entry) && typeof entry.field === 'string') {
      out.push({ field: entry.field, ...(typeof entry.fun === 'string' ? { fun: entry.fun } : {}) });
    } else {
      return null;
    }
  }
  return out;
}

/** Unwrap a legacy cell ({ value, orig } or primitive) to a plain value. */
function unwrapCell(cell: unknown): unknown {
  if (isRecord(cell)) {
    if ('value' in cell) return cell.value;
    if ('orig' in cell) return cell.orig;
  }
  return cell;
}

/** Extract a plain record from a normalized or legacy table row. */
function extractRowRecord(row: unknown, fields: string[]): Record<string, unknown> {
  let source: unknown = row;
  if (isRecord(row)) {
    if (isRecord(row.rowData)) source = row.rowData; // legacy view row
    else if (isRecord(row.data)) source = row.data; // normalized table row
  }
  const out: Record<string, unknown> = {};
  if (!isRecord(source)) return out;
  for (const field of fields) {
    if (field in source) out[field] = unwrapCell(source[field]);
  }
  return out;
}

/**
 * Coerce a getData payload to a flat row array. Handles the raw legacy view
 * shape ({ data: LegacyRow[] }), grouped data (LegacyRow[][]), and plain
 * arrays (tests/normalized hosts).
 */
function toRowArray(payload: unknown): unknown[] {
  const rows = Array.isArray(payload)
    ? payload
    : (isRecord(payload) && Array.isArray(payload.data) ? payload.data : []);
  return rows.flat();
}

/** Fetch all currently visible rows from the view (post filter/search). */
function fetchVisibleRows(ctx: GridToolContext): Promise<unknown[]> {
  return new Promise((resolve) => {
    ctx.view.getData((ok, data) => {
      const rows = toRowArray(ok ? data : null);
      resolve(rows.length > 0 ? rows : toRowArray(ctx.view.data));
    }, 'assistant');
  });
}

function getStateSnapshot(ctx: GridToolContext): Record<string, unknown> {
  const { view } = ctx;
  return {
    sort: view.getSort?.() ?? null,
    filter: view.getFilter?.() ?? null,
    group: view.getGroup?.() ?? null,
    pivot: view.getPivot?.() ?? null,
    aggregate: view.getAggregate?.() ?? null,
    rowCount: safeCount(() => view.getRowCount()),
    totalRowCount: safeCount(() => view.getTotalRowCount()),
    columns: ctx.columns,
  };
}

function safeCount(get: () => number): number {
  try {
    return get() ?? 0;
  } catch {
    return 0;
  }
}

function listPerspectives(prefs: PrefsInstance): PerspectiveInfo[] {
  const map = prefs.perspectives ?? {};
  const ids = Array.isArray(prefs.availablePerspectives)
    ? prefs.availablePerspectives
    : Object.keys(map);
  return ids.map((id) => ({
    id,
    name: map[id]?.name ?? id,
  }));
}

// ───────────────────────────────────────────────────────────
// Tool definitions
// ───────────────────────────────────────────────────────────

const setSortTool: GridToolDefinition = {
  name: 'grid_set_sort',
  description: 'Sort the grid by one or more columns in priority order. Replaces the current sort.',
  parameters: [
    {
      name: 'sorts',
      type: 'array',
      description: 'Priority-ordered list of { "field": string, "direction": "asc" | "desc" }',
      required: true,
    },
  ],
  execute(ctx, params) {
    const raw = params.sorts;
    if (!Array.isArray(raw) || raw.length === 0) return fail('Parameter "sorts" must be a non-empty array.');

    const sorts: Array<{ field: string; direction: 'asc' | 'desc' }> = [];
    for (const entry of raw) {
      if (!isRecord(entry) || typeof entry.field !== 'string') return fail('Each sort entry needs a "field" string.');
      const direction = entry.direction === 'desc' ? 'desc' : 'asc';
      sorts.push({ field: entry.field, direction });
    }

    const fieldError = validateFields(ctx, sorts.map((s) => s.field));
    if (fieldError) return fail(fieldError);

    ctx.view.setSort({
      vertical: sorts.map((s) => ({ field: s.field, dir: s.direction.toUpperCase() })),
    });
    fireSpecChange(ctx);
    return {
      ok: true,
      summary: `Sorted by ${sorts.map((s) => `${s.field} (${s.direction})`).join(', ')}.`,
    };
  },
};

const setFilterTool: GridToolDefinition = {
  name: 'grid_set_filter',
  description: 'Filter the grid rows. Replaces the current filter. The filter object maps field names to operator objects, e.g. { "salary": { "$gte": 50000 }, "department": { "$in": ["HR", "IT"] } }.',
  parameters: [
    {
      name: 'filter',
      type: 'object',
      description: 'Map of field name → { $operator: value }. Operators: $contains, $notcontains, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $notexists, $bet ([min, max]), $every, $this, $last.',
      required: true,
    },
  ],
  execute(ctx, params) {
    const filter = params.filter;
    if (!isRecord(filter) || Object.keys(filter).length === 0) {
      return fail('Parameter "filter" must be a non-empty object mapping field names to operator objects.');
    }

    const fieldError = validateFields(ctx, Object.keys(filter));
    if (fieldError) return fail(fieldError);

    for (const [field, spec] of Object.entries(filter)) {
      if (!isRecord(spec)) return fail(`Filter for "${field}" must be an object like { "$eq": value }.`);
      const badOps = Object.keys(spec).filter((op) => !FILTER_OPERATORS.has(op));
      if (badOps.length > 0) {
        return fail(`Unknown operator(s) on "${field}": ${badOps.join(', ')}. Valid operators: ${[...FILTER_OPERATORS].join(', ')}`);
      }
    }

    ctx.view.setFilter(filter);
    fireSpecChange(ctx);
    return {
      ok: true,
      summary: `Filtered on ${Object.keys(filter).join(', ')}. ${safeCount(() => ctx.view.getRowCount())} row(s) match.`,
    };
  },
};

function makeGroupPivotTool(kind: 'group' | 'pivot'): GridToolDefinition {
  return {
    name: `grid_set_${kind}`,
    description: kind === 'group'
      ? 'Group the grid rows by one or more fields. Date/time fields accept an optional "fun" bucketing function.'
      : 'Pivot the grid by one or more fields (creates a cross-tab). Requires a group to also be set.',
    parameters: [
      {
        name: 'fields',
        type: 'array',
        description: 'List of field names or { "field": string, "fun"?: string }. Bucketing functions (date/datetime fields): '
          + Object.keys(GROUP_FUNCTION_ALLOWED_TYPES).join(', '),
        required: true,
      },
    ],
    execute(ctx, params) {
      const fields = parseFieldList(params.fields);
      if (!fields || fields.length === 0) return fail('Parameter "fields" must be a non-empty array of field names or { field, fun } objects.');

      const fieldError = validateFields(ctx, fields.map((f) => f.field));
      if (fieldError) return fail(fieldError);

      for (const f of fields) {
        if (f.fun && !(f.fun in GROUP_FUNCTION_ALLOWED_TYPES)) {
          return fail(`Unknown group function "${f.fun}". Valid functions: ${Object.keys(GROUP_FUNCTION_ALLOWED_TYPES).join(', ')}`);
        }
      }

      const spec = buildGroupSpec(fields);
      if (kind === 'group') ctx.view.setGroup(spec);
      else ctx.view.setPivot(spec);
      fireSpecChange(ctx);
      return {
        ok: true,
        summary: `${kind === 'group' ? 'Grouped' : 'Pivoted'} by ${fields.map((f) => (f.fun ? `${f.field} (${f.fun})` : f.field)).join(', ')}.`,
      };
    },
  };
}

const setAggregateTool: GridToolDefinition = {
  name: 'grid_set_aggregate',
  description: 'Set aggregate calculations (shown per group and in totals). Replaces current aggregates.',
  parameters: [
    {
      name: 'aggregates',
      type: 'array',
      description: 'List of { "fn": string, "fields": string[] }. Common functions: count, sum, average, min, max, count_distinct.',
      required: true,
    },
  ],
  execute(ctx, params) {
    const raw = params.aggregates;
    if (!Array.isArray(raw) || raw.length === 0) return fail('Parameter "aggregates" must be a non-empty array.');

    const specs: Array<{ fn: string; fields: string[] }> = [];
    for (const entry of raw) {
      if (!isRecord(entry) || typeof entry.fn !== 'string' || !Array.isArray(entry.fields)) {
        return fail('Each aggregate entry needs { "fn": string, "fields": string[] }.');
      }
      specs.push({ fn: entry.fn, fields: entry.fields.filter((f): f is string => typeof f === 'string') });
    }

    const fieldError = validateFields(ctx, specs.flatMap((s) => s.fields));
    if (fieldError) return fail(fieldError);

    ctx.view.setAggregate(toLegacyAggregateSpec(specs));
    fireSpecChange(ctx);
    return {
      ok: true,
      summary: `Aggregates set: ${specs.map((s) => `${s.fn}(${s.fields.join(', ')})`).join('; ')}.`,
    };
  },
};

const CLEAR_TARGETS = ['sort', 'filter', 'group', 'pivot', 'aggregate', 'search', 'all'] as const;
type ClearTarget = typeof CLEAR_TARGETS[number];

const clearTool: GridToolDefinition = {
  name: 'grid_clear',
  description: 'Clear one or more grid settings.',
  parameters: [
    {
      name: 'targets',
      type: 'array',
      description: `List of settings to clear: ${CLEAR_TARGETS.join(', ')}.`,
      required: true,
    },
  ],
  execute(ctx, params) {
    const raw = params.targets;
    const targets = (Array.isArray(raw) ? raw : [raw]).filter((t): t is ClearTarget =>
      typeof t === 'string' && (CLEAR_TARGETS as readonly string[]).includes(t));
    if (targets.length === 0) return fail(`Parameter "targets" must contain at least one of: ${CLEAR_TARGETS.join(', ')}.`);

    const effective = new Set<ClearTarget>(targets.includes('all')
      ? CLEAR_TARGETS.filter((t) => t !== 'all')
      : targets);

    // Pivot depends on group — clear it first when clearing group.
    if (effective.has('group')) effective.add('pivot');

    if (effective.has('pivot')) ctx.view.clearPivot();
    if (effective.has('group')) ctx.view.clearGroup();
    if (effective.has('sort')) ctx.view.clearSort();
    if (effective.has('filter')) ctx.view.clearFilter();
    if (effective.has('aggregate')) ctx.view.clearAggregate();
    if (effective.has('search')) applyGlobalSearch(ctx, '');
    fireSpecChange(ctx);
    return { ok: true, summary: `Cleared: ${[...effective].join(', ')}.` };
  },
};

const globalSearchTool: GridToolDefinition = {
  name: 'grid_global_search',
  description: 'Search across all visible columns (visual filter, plain mode only). Pass an empty string to clear.',
  parameters: [
    { name: 'query', type: 'string', description: 'The search text; "" clears the search.', required: true },
  ],
  execute(ctx, params) {
    if (typeof params.query !== 'string') return fail('Parameter "query" must be a string.');
    applyGlobalSearch(ctx, params.query);
    return {
      ok: true,
      summary: params.query ? `Searching for "${params.query}".` : 'Search cleared.',
    };
  },
};

const resetTool: GridToolDefinition = {
  name: 'grid_reset',
  description: 'Reset the grid to its default state (clears sort, filter, group, pivot, aggregate, and search).',
  parameters: [],
  execute(ctx) {
    ctx.view.reset();
    applyGlobalSearch(ctx, '');
    fireSpecChange(ctx);
    return { ok: true, summary: 'Grid reset to defaults.' };
  },
};

const getStateTool: GridToolDefinition = {
  name: 'grid_get_state',
  description: 'Read the current grid configuration (sort, filter, group, pivot, aggregate, row counts, columns).',
  parameters: [],
  execute(ctx) {
    const state = getStateSnapshot(ctx);
    return {
      ok: true,
      summary: `Current state: ${state.rowCount} of ${state.totalRowCount} row(s) visible.`,
      data: state,
    };
  },
};

const getDataTool: GridToolDefinition = {
  name: 'grid_get_data',
  description: `Read a sample of the currently visible rows (max ${MAX_DATA_SAMPLE_ROWS}) to answer questions about the data.`,
  parameters: [
    { name: 'limit', type: 'number', description: `Max rows to return (default 20, cap ${MAX_DATA_SAMPLE_ROWS}).` },
    { name: 'fields', type: 'array', description: 'Optional list of field names to include (default: all).' },
  ],
  async execute(ctx, params) {
    const limit = Math.min(
      typeof params.limit === 'number' && params.limit > 0 ? Math.floor(params.limit) : 20,
      MAX_DATA_SAMPLE_ROWS,
    );
    const requested = Array.isArray(params.fields)
      ? params.fields.filter((f): f is string => typeof f === 'string')
      : null;
    if (requested && requested.length > 0) {
      const fieldError = validateFields(ctx, requested);
      if (fieldError) return fail(fieldError);
    }
    const fields = requested && requested.length > 0 ? requested : ctx.columns.map((c) => c.field);

    const rows = await fetchVisibleRows(ctx);

    const sample = rows.slice(0, limit).map((row) => extractRowRecord(row, fields));
    return {
      ok: true,
      summary: `Returning ${sample.length} of ${rows.length} row(s).`,
      data: { rows: sample, totalRows: safeCount(() => ctx.view.getTotalRowCount()), visibleRows: rows.length },
    };
  },
};

// ───────────────────────────────────────────────────────────
// Data query (computed answers over the full visible dataset)
// ───────────────────────────────────────────────────────────

const QUERY_OPERATIONS = ['count', 'sum', 'avg', 'min', 'max', 'distinct'] as const;
type QueryOperation = (typeof QUERY_OPERATIONS)[number];

/** Case-insensitive condition match for a single row value. */
function matchesCondition(value: unknown, operator: string, expected: unknown): boolean {
  const str = (v: unknown) => String(v ?? '').toLowerCase();
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  switch (operator) {
    case '$eq': return str(value) === str(expected);
    case '$ne': return str(value) !== str(expected);
    case '$gt': return num(value) > num(expected);
    case '$gte': return num(value) >= num(expected);
    case '$lt': return num(value) < num(expected);
    case '$lte': return num(value) <= num(expected);
    case '$contains': return str(value).includes(str(expected));
    case '$notcontains': return !str(value).includes(str(expected));
    case '$in': return Array.isArray(expected) && expected.some((e) => str(e) === str(value));
    case '$nin': return Array.isArray(expected) && !expected.some((e) => str(e) === str(value));
    default: return false;
  }
}

/** Compute one aggregate over a list of raw cell values. */
function computeAggregate(operation: QueryOperation, values: unknown[]): number | unknown[] {
  if (operation === 'count') return values.length;
  if (operation === 'distinct') {
    const seen = new Map<string, unknown>();
    for (const v of values) {
      const key = String(v ?? '').toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
    return [...seen.values()];
  }
  const nums = values.map((v) => (typeof v === 'number' ? v : Number(v))).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return NaN;
  switch (operation) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
  }
}

const queryDataTool: GridToolDefinition = {
  name: 'grid_query_data',
  description: 'Compute an answer over ALL currently visible rows (count, sum, avg, min, max, or distinct values), with optional conditions and grouping. Use this to answer questions about the data — it is exact, unlike sampling with grid_get_data.',
  parameters: [
    { name: 'operation', type: 'string', description: `One of: ${QUERY_OPERATIONS.join(', ')}.`, required: true },
    { name: 'field', type: 'string', description: 'Field to aggregate (required except for count).' },
    { name: 'where', type: 'array', description: 'Optional conditions, each { field, operator, value }. Operators: $eq, $ne, $gt, $gte, $lt, $lte, $contains, $notcontains, $in, $nin. All must match (AND).' },
    { name: 'groupBy', type: 'string', description: 'Optional field to group results by (returns one value per group).' },
  ],
  async execute(ctx, params) {
    const operation = typeof params.operation === 'string' ? params.operation as QueryOperation : 'count';
    if (!QUERY_OPERATIONS.includes(operation)) {
      return fail(`Unknown operation "${params.operation}". Use one of: ${QUERY_OPERATIONS.join(', ')}.`);
    }
    const field = typeof params.field === 'string' ? params.field : null;
    if (!field && operation !== 'count') return fail(`Parameter "field" is required for ${operation}.`);
    const groupBy = typeof params.groupBy === 'string' ? params.groupBy : null;

    const where = Array.isArray(params.where) ? params.where.filter(isRecord) : [];
    const referenced = [
      ...(field ? [field] : []),
      ...(groupBy ? [groupBy] : []),
      ...where.map((c) => String(c.field)),
    ];
    const fieldError = validateFields(ctx, referenced);
    if (fieldError) return fail(fieldError);

    const allFields = ctx.columns.map((c) => c.field);
    const rows = (await fetchVisibleRows(ctx)).map((row) => extractRowRecord(row, allFields));
    const matched = rows.filter((row) =>
      where.every((c) => matchesCondition(row[String(c.field)], String(c.operator), c.value)));

    const valueOf = (row: Record<string, unknown>) => (field ? row[field] : null);
    if (!groupBy) {
      const result = computeAggregate(operation, matched.map(valueOf));
      return {
        ok: true,
        summary: `${operation}${field ? ` of ${field}` : ''} over ${matched.length} matching row(s): ${Array.isArray(result) ? result.join(', ') : result}.`,
        data: { operation, field, matchedRows: matched.length, result },
      };
    }

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of matched) {
      const key = String(row[groupBy] ?? '');
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const byGroup = Object.fromEntries(
      [...groups.entries()].map(([key, groupRows]) => [key, computeAggregate(operation, groupRows.map(valueOf))]),
    );
    return {
      ok: true,
      summary: `${operation}${field ? ` of ${field}` : ''} by ${groupBy} over ${matched.length} row(s): ${JSON.stringify(byGroup)}.`,
      data: { operation, field, groupBy, matchedRows: matched.length, result: byGroup },
    };
  },
};

const perspectiveListTool: GridToolDefinition = {
  name: 'perspective_list',
  description: 'List saved perspectives (named grid configurations).',
  parameters: [],
  execute(ctx) {
    if (!ctx.prefs) return fail('Perspectives are not available on this grid.');
    const perspectives = listPerspectives(ctx.prefs);
    const currentId = ctx.prefs.currentPerspective?.id ?? ctx.prefs.getCurrentPerspective?.()?.id ?? null;
    return {
      ok: true,
      summary: perspectives.length > 0
        ? `${perspectives.length} perspective(s): ${perspectives.map((p) => p.name).join(', ')}.`
        : 'No saved perspectives.',
      data: { perspectives, currentId },
    };
  },
};

const perspectiveSaveTool: GridToolDefinition = {
  name: 'perspective_save',
  description: 'Save the current grid configuration as a named perspective.',
  parameters: [
    { name: 'name', type: 'string', description: 'Name for the new perspective.', required: true },
  ],
  execute(ctx, params) {
    if (!ctx.prefs) return fail('Perspectives are not available on this grid.');
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return fail('Parameter "name" must be a non-empty string.');

    const prefs = ctx.prefs;
    // Mirror usePrefs.addPerspective: legacy signature takes (id, name, config, opts, cont).
    if (prefs.addPerspective.length > 1) {
      prefs.addPerspective(null, name, null, null, () => {
        (prefs.reallySave ?? prefs.save)?.call(prefs);
      });
    } else {
      prefs.addPerspective(name);
    }
    return { ok: true, summary: `Saved perspective "${name}".` };
  },
};

const perspectiveLoadTool: GridToolDefinition = {
  name: 'perspective_load',
  description: 'Switch to a saved perspective by name or id.',
  parameters: [
    { name: 'name', type: 'string', description: 'Name (or id) of the perspective to load.', required: true },
  ],
  execute(ctx, params) {
    if (!ctx.prefs) return fail('Perspectives are not available on this grid.');
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return fail('Parameter "name" must be a non-empty string.');

    const perspectives = listPerspectives(ctx.prefs);
    const match = perspectives.find((p) => p.id === name)
      ?? perspectives.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      return fail(`No perspective named "${name}". Available: ${perspectives.map((p) => p.name).join(', ') || '(none)'}`);
    }

    ctx.prefs.setCurrentPerspective(match.id);
    return { ok: true, summary: `Loaded perspective "${match.name}".` };
  },
};

// ───────────────────────────────────────────────────────────
// Registry
// ───────────────────────────────────────────────────────────

/** All tools available to the grid assistant, in prompt order. */
export const GRID_TOOLS: GridToolDefinition[] = [
  setSortTool,
  setFilterTool,
  makeGroupPivotTool('group'),
  makeGroupPivotTool('pivot'),
  setAggregateTool,
  clearTool,
  globalSearchTool,
  resetTool,
  getStateTool,
  getDataTool,
  queryDataTool,
  perspectiveListTool,
  perspectiveSaveTool,
  perspectiveLoadTool,
];

const TOOLS_BY_NAME = new Map(GRID_TOOLS.map((t) => [t.name, t]));

/** Look up a tool definition by name. */
export function getGridTool(name: string): GridToolDefinition | undefined {
  return TOOLS_BY_NAME.get(name);
}

/**
 * Execute a named tool against the grid. Unknown tools and thrown errors
 * become failed results rather than exceptions so the LLM can self-correct.
 */
export async function executeGridTool(
  ctx: GridToolContext,
  name: string,
  params: Record<string, unknown>,
): Promise<GridToolResult> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) {
    return fail(`Unknown tool "${name}". Available tools: ${GRID_TOOLS.map((t) => t.name).join(', ')}`);
  }
  try {
    return await tool.execute(ctx, params ?? {});
  } catch (err) {
    return fail(`Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
