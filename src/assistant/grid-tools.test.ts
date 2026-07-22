import { describe, expect, it, vi } from 'vitest';

// datavis-ace requires a browser environment at import time; the tools under
// test only use pure helpers, so stub the package for node-based unit tests.
vi.mock('datavis-ace', () => ({
  AGGREGATE_REGISTRY: { each: () => {} },
}));

import type { ViewInstance } from '../adapters/use-data';
import {
  ASSISTANT_GLOBAL_SEARCH_EVENT,
  ASSISTANT_SPEC_CHANGE_EVENT,
  executeGridTool,
  GRID_TOOLS,
  type GridToolContext,
} from './grid-tools';

function createMockView(overrides: Partial<Record<keyof ViewInstance, unknown>> = {}): ViewInstance {
  return {
    setSort: vi.fn(),
    setFilter: vi.fn(),
    setGroup: vi.fn(),
    setPivot: vi.fn(),
    setAggregate: vi.fn(),
    clearSort: vi.fn(),
    clearFilter: vi.fn(),
    clearGroup: vi.fn(),
    clearPivot: vi.fn(),
    clearAggregate: vi.fn(),
    getSort: vi.fn(() => null),
    getFilter: vi.fn(() => null),
    getGroup: vi.fn(() => null),
    getPivot: vi.fn(() => null),
    getAggregate: vi.fn(() => null),
    getRowCount: vi.fn(() => 3),
    getTotalRowCount: vi.fn(() => 10),
    getData: vi.fn((cont?: (ok: boolean, data: unknown) => void) => {
      cont?.(true, [
        { data: { name: 'Alice', salary: { value: 100, orig: 100 } } },
        { data: { name: 'Bob', salary: 90 } },
      ]);
    }),
    reset: vi.fn(),
    refresh: vi.fn(),
    fire: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    ...overrides,
  } as unknown as ViewInstance;
}

function createContext(overrides: Partial<GridToolContext> = {}): GridToolContext {
  return {
    view: createMockView(),
    columns: [
      { field: 'name', header: 'Name', type: 'string' },
      { field: 'salary', header: 'Salary', type: 'currency' },
      { field: 'hired', header: 'Hired', type: 'date' },
    ],
    ...overrides,
  };
}

describe('executeGridTool', () => {
  it('rejects unknown tools with the available tool list', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_do_magic', {});
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('grid_set_sort');
  });

  it('turns thrown errors into failed results', async () => {
    const ctx = createContext({
      view: createMockView({ setSort: vi.fn(() => { throw new Error('boom'); }) }),
    });
    const result = await executeGridTool(ctx, 'grid_set_sort', { sorts: [{ field: 'name', direction: 'asc' }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('boom');
  });
});

describe('grid_set_sort', () => {
  it('maps sorts to the legacy vertical spec and fires the sync event', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_sort', {
      sorts: [{ field: 'salary', direction: 'desc' }, { field: 'name' }],
    });

    expect(result.ok).toBe(true);
    expect(ctx.view.setSort).toHaveBeenCalledWith({
      vertical: [
        { field: 'salary', dir: 'DESC' },
        { field: 'name', dir: 'ASC' },
      ],
    });
    expect(ctx.view.fire).toHaveBeenCalledWith(ASSISTANT_SPEC_CHANGE_EVENT);
  });

  it('rejects unknown fields with the available field list', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_sort', {
      sorts: [{ field: 'bogus', direction: 'asc' }],
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('bogus');
    expect(result.summary).toContain('name');
    expect(ctx.view.setSort).not.toHaveBeenCalled();
  });
});

describe('grid_set_filter', () => {
  it('passes a validated filter spec through', async () => {
    const ctx = createContext();
    const filter = { salary: { $gte: 50000 }, name: { $contains: 'ali' } };
    const result = await executeGridTool(ctx, 'grid_set_filter', { filter });

    expect(result.ok).toBe(true);
    expect(ctx.view.setFilter).toHaveBeenCalledWith(filter);
  });

  it('rejects unknown operators', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_filter', {
      filter: { salary: { $near: 100 } },
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('$near');
    expect(ctx.view.setFilter).not.toHaveBeenCalled();
  });
});

describe('grid_set_group / grid_set_pivot', () => {
  it('accepts plain field names and { field, fun } objects', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_group', {
      fields: ['name', { field: 'hired', fun: 'month' }],
    });

    expect(result.ok).toBe(true);
    expect(ctx.view.setGroup).toHaveBeenCalledWith({
      fieldNames: [{ field: 'name' }, { field: 'hired', fun: 'month' }],
    });
  });

  it('rejects unknown group functions', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_group', {
      fields: [{ field: 'hired', fun: 'fortnight' }],
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('fortnight');
  });

  it('pivots via setPivot', async () => {
    const ctx = createContext();
    await executeGridTool(ctx, 'grid_set_pivot', { fields: ['name'] });
    expect(ctx.view.setPivot).toHaveBeenCalledWith({ fieldNames: [{ field: 'name' }] });
  });
});

describe('grid_set_aggregate', () => {
  it('converts entries to the legacy aggregate spec map', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_set_aggregate', {
      aggregates: [{ fn: 'sum', fields: ['salary'] }],
    });

    expect(result.ok).toBe(true);
    const spec = vi.mocked(ctx.view.setAggregate).mock.calls[0][0] as Record<string, unknown>;
    expect(spec.group).toEqual([{ fun: 'sum', fields: ['salary'] }]);
    expect(spec.all).toEqual([{ fun: 'sum', fields: ['salary'] }]);
  });
});

describe('grid_clear', () => {
  it('clears the requested targets and cascades group → pivot', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_clear', { targets: ['group', 'sort'] });

    expect(result.ok).toBe(true);
    expect(ctx.view.clearGroup).toHaveBeenCalled();
    expect(ctx.view.clearPivot).toHaveBeenCalled();
    expect(ctx.view.clearSort).toHaveBeenCalled();
    expect(ctx.view.clearFilter).not.toHaveBeenCalled();
  });

  it('clears everything with "all"', async () => {
    const setGlobalSearch = vi.fn();
    const ctx = createContext({ setGlobalSearch });
    await executeGridTool(ctx, 'grid_clear', { targets: ['all'] });

    expect(ctx.view.clearSort).toHaveBeenCalled();
    expect(ctx.view.clearFilter).toHaveBeenCalled();
    expect(ctx.view.clearGroup).toHaveBeenCalled();
    expect(ctx.view.clearPivot).toHaveBeenCalled();
    expect(ctx.view.clearAggregate).toHaveBeenCalled();
    expect(setGlobalSearch).toHaveBeenCalledWith('');
  });
});

describe('grid_global_search', () => {
  it('uses the host callback when provided', async () => {
    const setGlobalSearch = vi.fn();
    const ctx = createContext({ setGlobalSearch });
    await executeGridTool(ctx, 'grid_global_search', { query: 'smith' });
    expect(setGlobalSearch).toHaveBeenCalledWith('smith');
    expect(ctx.view.fire).not.toHaveBeenCalledWith(ASSISTANT_GLOBAL_SEARCH_EVENT, {}, 'smith');
  });

  it('falls back to the view event bridge', async () => {
    const ctx = createContext();
    await executeGridTool(ctx, 'grid_global_search', { query: 'smith' });
    expect(ctx.view.fire).toHaveBeenCalledWith(ASSISTANT_GLOBAL_SEARCH_EVENT, {}, 'smith');
  });
});

describe('grid_get_state', () => {
  it('returns the current spec snapshot and row counts', async () => {
    const ctx = createContext({
      view: createMockView({ getSort: vi.fn(() => ({ vertical: [{ field: 'name', dir: 'ASC' }] })) }),
    });
    const result = await executeGridTool(ctx, 'grid_get_state', {});

    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.sort).toEqual({ vertical: [{ field: 'name', dir: 'ASC' }] });
    expect(data.rowCount).toBe(3);
    expect(data.totalRowCount).toBe(10);
  });
});

describe('grid_get_data', () => {
  it('unwraps legacy cells and respects the field selection', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'grid_get_data', { fields: ['salary'] });

    expect(result.ok).toBe(true);
    const data = result.data as { rows: Record<string, unknown>[] };
    expect(data.rows).toEqual([{ salary: 100 }, { salary: 90 }]);
  });

  it('caps the returned row count', async () => {
    const manyRows = Array.from({ length: 200 }, (_, i) => ({ data: { name: `p${i}` } }));
    const ctx = createContext({
      view: createMockView({
        getData: vi.fn((cont?: (ok: boolean, data: unknown) => void) => cont?.(true, manyRows)),
      }),
    });
    const result = await executeGridTool(ctx, 'grid_get_data', { limit: 500 });
    const data = result.data as { rows: unknown[] };
    expect(data.rows).toHaveLength(50);
  });

  it('reads the raw legacy view shape ({ data: [{ rowNum, rowData }] })', async () => {
    const legacyPayload = {
      data: [
        { rowNum: 0, rowData: { name: { value: 'Alice', orig: 'Alice' }, salary: { value: 100 } } },
        { rowNum: 1, rowData: { name: 'Bob', salary: 90 } },
      ],
    };
    const ctx = createContext({
      view: createMockView({
        getData: vi.fn((cont?: (ok: boolean, data: unknown) => void) => cont?.(true, legacyPayload)),
      }),
    });
    const result = await executeGridTool(ctx, 'grid_get_data', { fields: ['name', 'salary'] });
    expect(result.ok).toBe(true);
    const data = result.data as { rows: Record<string, unknown>[] };
    expect(data.rows).toEqual([{ name: 'Alice', salary: 100 }, { name: 'Bob', salary: 90 }]);
  });
});

describe('grid_query_data', () => {
  function createSalaryContext() {
    const rows = [
      { data: { name: 'Alice', department: 'Marketing', salary: { value: 100, orig: 100 } } },
      { data: { name: 'Bob', department: 'marketing', salary: 60 } },
      { data: { name: 'Cara', department: 'Engineering', salary: 200 } },
    ];
    return createContext({
      view: createMockView({
        getData: vi.fn((cont?: (ok: boolean, data: unknown) => void) => cont?.(true, rows)),
      }),
      columns: [
        { field: 'name', header: 'Name', type: 'string' },
        { field: 'department', header: 'Department', type: 'string' },
        { field: 'salary', header: 'Salary', type: 'currency' },
      ],
    });
  }

  it('counts all visible rows', async () => {
    const result = await executeGridTool(createSalaryContext(), 'grid_query_data', { operation: 'count' });
    expect(result.ok).toBe(true);
    expect((result.data as { result: number }).result).toBe(3);
  });

  it('averages a field with a case-insensitive where condition', async () => {
    const result = await executeGridTool(createSalaryContext(), 'grid_query_data', {
      operation: 'avg',
      field: 'salary',
      where: [{ field: 'department', operator: '$eq', value: 'Marketing' }],
    });
    expect(result.ok).toBe(true);
    expect((result.data as { result: number }).result).toBe(80);
  });

  it('groups results by a field', async () => {
    const result = await executeGridTool(createSalaryContext(), 'grid_query_data', {
      operation: 'sum',
      field: 'salary',
      groupBy: 'department',
    });
    expect(result.ok).toBe(true);
    const byGroup = (result.data as { result: Record<string, number> }).result;
    expect(byGroup).toEqual({ Marketing: 100, marketing: 60, Engineering: 200 });
  });

  it('returns distinct values', async () => {
    const result = await executeGridTool(createSalaryContext(), 'grid_query_data', {
      operation: 'distinct',
      field: 'department',
    });
    expect(result.ok).toBe(true);
    expect((result.data as { result: unknown[] }).result).toEqual(['Marketing', 'Engineering']);
  });

  it('rejects unknown operations and missing fields', async () => {
    const badOp = await executeGridTool(createSalaryContext(), 'grid_query_data', { operation: 'median' });
    expect(badOp.ok).toBe(false);
    const noField = await executeGridTool(createSalaryContext(), 'grid_query_data', { operation: 'avg' });
    expect(noField.ok).toBe(false);
    const badField = await executeGridTool(createSalaryContext(), 'grid_query_data', { operation: 'avg', field: 'bogus' });
    expect(badField.ok).toBe(false);
    expect(badField.summary).toContain('Unknown field');
  });
});

describe('perspectives', () => {
  function createMockPrefs() {
    return {
      perspectives: {
        'p-1': { id: 'p-1', name: 'HR View' },
        'p-2': { id: 'p-2', name: 'Finance' },
      },
      availablePerspectives: ['p-1', 'p-2'],
      currentPerspective: { id: 'p-1', name: 'HR View' },
      addPerspective: vi.fn(),
      setCurrentPerspective: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      fire: vi.fn(),
    };
  }

  it('lists perspectives by name', async () => {
    const prefs = createMockPrefs();
    const ctx = createContext({ prefs: prefs as never });
    const result = await executeGridTool(ctx, 'perspective_list', {});

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('HR View');
    expect(result.summary).toContain('Finance');
  });

  it('loads a perspective by case-insensitive name', async () => {
    const prefs = createMockPrefs();
    const ctx = createContext({ prefs: prefs as never });
    const result = await executeGridTool(ctx, 'perspective_load', { name: 'finance' });

    expect(result.ok).toBe(true);
    expect(prefs.setCurrentPerspective).toHaveBeenCalledWith('p-2');
  });

  it('fails cleanly when prefs are unavailable', async () => {
    const ctx = createContext();
    const result = await executeGridTool(ctx, 'perspective_save', { name: 'X' });
    expect(result.ok).toBe(false);
  });
});

describe('tool registry', () => {
  it('every tool has a unique name and a description', () => {
    const names = GRID_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of GRID_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});
