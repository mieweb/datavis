import { expect, test } from '@playwright/test';

import { getState, gotoHarness, runAction, runActionWithArg } from './helpers';
import { LEGACY_AGG_FUNCTIONS, LEGACY_GROUP_FUNCTIONS, LEGACY_MATRIX_ROWS } from '../../src/testing/legacyMatrixData';

function numericValue(value: unknown) {
  if (typeof value === 'number') return value;
  return Number(String(value).replaceAll(',', ''));
}

function compareDates(value: unknown) {
  return new Date(String(value)).getTime();
}

function parseDateOnly(value: unknown) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function sameCalendarDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function sameIsoWeek(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && isoWeek(left) === isoWeek(right);
}

function quarterOf(date: Date) {
  return Math.floor(date.getMonth() / 3);
}

function previousPeriodReference(period: 'day' | 'week' | 'month' | 'quarter' | 'year', now: Date) {
  const previous = new Date(now);

  if (period === 'day') {
    previous.setDate(previous.getDate() - 1);
    return previous;
  }

  if (period === 'week') {
    previous.setDate(previous.getDate() - 7);
    return previous;
  }

  if (period === 'month') {
    previous.setMonth(previous.getMonth() - 1);
    return previous;
  }

  if (period === 'quarter') {
    previous.setMonth(previous.getMonth() - 3);
    return previous;
  }

  previous.setFullYear(previous.getFullYear() - 1);
  return previous;
}

function isoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));
}

function expectedCurrentPeriodCount(period: 'day' | 'week' | 'month' | 'quarter' | 'year') {
  const now = new Date();
  return LEGACY_MATRIX_ROWS.filter((row) => {
    const date = parseDateOnly(row.date1);
    if (period === 'day') return sameCalendarDay(date, now);
    if (period === 'week') return sameIsoWeek(date, now);
    if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (period === 'quarter') return date.getFullYear() === now.getFullYear() && quarterOf(date) === quarterOf(now);
    return date.getFullYear() === now.getFullYear();
  }).length;
}

function expectedLastPeriodCount(period: 'day' | 'week' | 'month' | 'quarter' | 'year') {
  const reference = previousPeriodReference(period, new Date());
  return LEGACY_MATRIX_ROWS.filter((row) => {
    const date = parseDateOnly(row.date1);
    if (period === 'day') return sameCalendarDay(date, reference);
    if (period === 'week') return sameIsoWeek(date, reference);
    if (period === 'month') return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
    if (period === 'quarter') return date.getFullYear() === reference.getFullYear() && quarterOf(date) === quarterOf(reference);
    return date.getFullYear() === reference.getFullYear();
  }).length;
}

function applyExpectedGroupFunction(value: string, fun: string) {
  const date = new Date(value);
  switch (fun) {
    case 'year':
      return String(date.getFullYear());
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'month':
      return date.toLocaleString('en-US', { month: 'long' });
    case 'week_iso':
      return `W${String(isoWeek(date)).padStart(2, '0')}`;
    case 'day_of_week':
      return date.toLocaleString('en-US', { weekday: 'long' });
    case 'year_and_quarter':
      return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'year_and_month':
      return `${date.getFullYear()} ${date.toLocaleString('en-US', { month: 'long' })}`;
    case 'year_and_week_iso':
      return `${date.getFullYear()} W${String(isoWeek(date)).padStart(2, '0')}`;
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'day_and_time_1hr':
      return `${date.toISOString().slice(0, 10)} ${new Date(date.setMinutes(0, 0, 0)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    case 'day_and_time_15min': {
      const rounded = new Date(date);
      rounded.setMinutes(Math.floor(rounded.getMinutes() / 15) * 15, 0, 0);
      return `${date.toISOString().slice(0, 10)} ${rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    case 'time_1hr': {
      const rounded = new Date(date);
      rounded.setMinutes(0, 0, 0);
      return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    case 'time_15min': {
      const rounded = new Date(date);
      rounded.setMinutes(Math.floor(rounded.getMinutes() / 15) * 15, 0, 0);
      return rounded.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    default:
      return value;
  }
}

test.describe('Legacy Exhaustive Matrix', () => {
  const stringFilterCases = [
    { name: '$in single', spec: { country: { $in: ['Canada'] } }, expected: 2 },
    { name: '$nin single', spec: { country: { $nin: ['Canada'] } }, expected: 6 },
    { name: '$in multi', spec: { country: { $in: ['Canada', 'Japan'] } }, expected: 4 },
    { name: '$nin multi', spec: { country: { $nin: ['Canada', 'Japan'] } }, expected: 4 },
  ];

  for (const filterCase of stringFilterCases) {
    test(`filter.js: string filter ${filterCase.name}`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, filterCase.spec, (spec) => {
        window.__wcdv!.actions.setFilter(spec as never);
      });
      expect((await getState(page)).rowCount).toBe(filterCase.expected);
    });
  }

  const numericFields = [...Array.from({ length: 9 }, (_, index) => `int${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `float${index + 1}`)];
  const numericOperatorCases = [
    { op: '$eq', value: 40 },
    { op: '$ne', value: 40 },
    { op: '$lt', value: 40 },
    { op: '$gt', value: 40 },
    { op: '$lte', value: 40 },
    { op: '$gte', value: 40 },
  ] as const;

  for (const field of numericFields) {
    for (const operatorCase of numericOperatorCases) {
      test(`filter.js: ${field} supports ${operatorCase.op}`, async ({ page }) => {
        await gotoHarness(page, 'matrix');

        const expected = LEGACY_MATRIX_ROWS.filter((row) => {
          const value = numericValue(row[field]);
          const target = operatorCase.value;
          if (operatorCase.op === '$eq') return value === target;
          if (operatorCase.op === '$ne') return value !== target;
          if (operatorCase.op === '$lt') return value < target;
          if (operatorCase.op === '$gt') return value > target;
          if (operatorCase.op === '$lte') return value <= target;
          return value >= target;
        }).length;

        await runActionWithArg(page, { field, op: operatorCase.op, value: operatorCase.value }, (payload) => {
          window.__wcdv!.actions.setFilter({ [payload.field]: { [payload.op]: payload.value } } as never);
        });

        expect((await getState(page)).rowCount).toBe(expected);
      });
    }
  }

  const dateFields = ['date1', 'date2', 'date3'] as const;
  const dateOperatorCases = [
    { op: '$eq', value: '2026-03-11', expected: 1 },
    { op: '$lte', value: '2025-03-11', expected: 3 },
    { op: '$gte', value: '2026-02-15', expected: 4 },
    { op: '$bet', value: ['2026-02-01', '2026-03-31'], expected: 4 },
    { op: '$exists', value: true, expected: 8 },
    { op: '$notexists', value: true, expected: 0 },
  ] as const;

  for (const field of dateFields) {
    for (const operatorCase of dateOperatorCases) {
      test(`date_filter.js: ${field} supports ${operatorCase.op}`, async ({ page }) => {
        await gotoHarness(page, 'matrix');
        await runActionWithArg(page, { field, op: operatorCase.op, value: operatorCase.value }, (payload) => {
          window.__wcdv!.actions.setFilter({ [payload.field]: { [payload.op]: payload.value } } as never);
        });
        expect((await getState(page)).rowCount).toBe(operatorCase.expected);
      });
    }
  }

  for (const period of ['day', 'week', 'month', 'quarter', 'year'] as const) {
    test(`date_filter.js: current ${period} operator narrows results`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, period, (value) => {
        window.__wcdv!.actions.setFilter({ date1: { $this: value } } as never);
      });
      expect((await getState(page)).rowCount).toBe(expectedCurrentPeriodCount(period));
    });

    test(`date_filter.js: last ${period} operator narrows results`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, period, (value) => {
        window.__wcdv!.actions.setFilter({ date1: { $last: value } } as never);
      });
      expect((await getState(page)).rowCount).toBe(expectedLastPeriodCount(period));
    });
  }

  for (const everyCase of [
    { label: 'every Wednesday', spec: { $every: { unit: 'day', value: '3' } }, expected: 2 },
    { label: 'every March', spec: { $every: { unit: 'month', value: '2' } }, expected: 6 },
  ]) {
    test(`date_filter.js: ${everyCase.label}`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, everyCase.spec, (spec) => {
        window.__wcdv!.actions.setFilter({ date1: spec } as never);
      });
      expect((await getState(page)).rowCount).toBe(everyCase.expected);
    });
  }

  const sortCases = [
    { field: 'string1', ascFirst: 'alpha', ascLast: 'hotel' },
    { field: 'int1', ascFirst: 10, ascLast: 80 },
    { field: 'float1', ascFirst: 10.5, ascLast: 80.25 },
    { field: 'currency1', ascFirst: 10.5, ascLast: 80.25 },
    { field: 'date1', ascFirst: '2024-03-11', ascLast: '2026-03-11' },
    { field: 'datetime1', ascFirst: '2024-03-11T05:20', ascLast: '2026-03-11T09:00' },
    { field: 'time1', ascFirst: '05:20:00', ascLast: '23:30:00' },
    { field: 'duration1', ascFirst: '01:00:00', ascLast: '08:00:00' },
    { field: 'active', ascFirst: false, ascLast: true },
  ] as const;

  for (const sortCase of sortCases) {
    test(`sort.js: ${sortCase.field} sorts ascending and descending`, async ({ page }) => {
      await gotoHarness(page, 'matrix');

      await runActionWithArg(page, sortCase.field, (field) => {
        window.__wcdv!.actions.setSort(field, 'ASC');
      });
      let state = await getState(page);
      expect(state.visibleRows[0][sortCase.field]).toBe(sortCase.ascFirst);
      expect(state.visibleRows.at(-1)?.[sortCase.field]).toBe(sortCase.ascLast);

      await runActionWithArg(page, sortCase.field, (field) => {
        window.__wcdv!.actions.setSort(field, 'DESC');
      });
      state = await getState(page);
      expect(state.visibleRows[0][sortCase.field]).toBe(sortCase.ascLast);
      expect(state.visibleRows.at(-1)?.[sortCase.field]).toBe(sortCase.ascFirst);
    });
  }

  for (const groupField of ['country', 'int1', 'active', 'date1', 'datetime1'] as const) {
    test(`grouping: ${groupField} can be grouped`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, groupField, (field) => {
        window.__wcdv!.actions.setGroup([field]);
      });
      const state = await getState(page);
      expect(state.mode).toBe('group');
      expect(state.groupFields).toEqual([groupField]);
    });
  }

  for (const agg of LEGACY_AGG_FUNCTIONS) {
    test(`aggregate.js: ${agg} works in grouped output`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runAction(page, () => {
        window.__wcdv!.actions.setGroup(['category']);
      });
      const fields = agg === 'count'
        ? []
        : agg === 'counta'
        ? ['notes']
        : agg === 'countu'
        ? ['country']
        : agg === 'list'
        ? ['fruit']
        : ['int1'];
      await runActionWithArg(page, { agg, fields }, (payload) => {
        window.__wcdv!.actions.setAggregate([{ fn: payload.agg, fields: payload.fields }] as never);
      });

      const state = await getState(page);
      const entries = Object.values(state.groupMetadata) as Array<{ groupValues: { category: string }; aggregates: Record<string, unknown> }>;
      const fruit = entries.find((entry) => entry.groupValues.category === 'Fruit');
      const vegetables = entries.find((entry) => entry.groupValues.category === 'Vegetables');
      const key = fields[0] ? `${agg}(${fields[0]})` : agg;

      if (agg === 'count') {
        expect(fruit?.aggregates[key]).toBe(6);
        expect(vegetables?.aggregates[key]).toBe(2);
      } else if (agg === 'counta') {
        expect(fruit?.aggregates[key]).toBe(4);
        expect(vegetables?.aggregates[key]).toBe(0);
      } else if (agg === 'countu') {
        expect(fruit?.aggregates[key]).toBe(4);
        expect(vegetables?.aggregates[key]).toBe(2);
      } else if (agg === 'list') {
        expect(fruit?.aggregates[key]).toBe('Apple, Banana');
        expect(vegetables?.aggregates[key]).toBe('Carrot');
      } else if (agg === 'sum') {
        expect(fruit?.aggregates[key]).toBe(260);
        expect(vegetables?.aggregates[key]).toBe(100);
      } else if (agg === 'avg') {
        expect(fruit?.aggregates[key]).toBeCloseTo(43.3333333333, 6);
        expect(vegetables?.aggregates[key]).toBe(50);
      } else if (agg === 'min') {
        expect(fruit?.aggregates[key]).toBe(10);
        expect(vegetables?.aggregates[key]).toBe(40);
      } else if (agg === 'max') {
        expect(fruit?.aggregates[key]).toBe(80);
        expect(vegetables?.aggregates[key]).toBe(60);
      }
    });
  }

  for (const groupFunction of LEGACY_GROUP_FUNCTIONS) {
    test(`group-funs.js: ${groupFunction} transforms grouped values`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      const field = groupFunction.startsWith('time_') ? 'datetime1' : groupFunction.startsWith('day_and_time_') ? 'datetime1' : groupFunction === 'day' ? 'datetime1' : 'date1';
      await runActionWithArg(page, { field, fun: groupFunction }, (payload) => {
        window.__wcdv!.actions.setGroupSpec([{ field: payload.field, fun: payload.fun }] as never);
      });

      const state = await getState(page);
      const actualValues = Object.values(state.groupMetadata)
        .map((entry) => (entry as { groupValues: Record<string, unknown> }).groupValues[field])
        .sort();
      const expectedValues = [...new Set(LEGACY_MATRIX_ROWS.map((row) => applyExpectedGroupFunction(String(row[field]), groupFunction)))].sort();
      expect(actualValues).toEqual(expectedValues);
    });
  }

  for (const pivotField of ['country', 'int1', 'active', 'date1', 'datetime1'] as const) {
    test(`pivot: ${pivotField} can be pivoted`, async ({ page }) => {
      await gotoHarness(page, 'matrix');
      await runActionWithArg(page, 'category', (field) => {
        window.__wcdv!.actions.setGroup([field]);
      });
      await runAction(page, () => {
        window.__wcdv!.actions.setAggregate([{ fn: 'sum', fields: ['int1'] }] as never);
      });
      await runActionWithArg(page, pivotField, (field) => {
        window.__wcdv!.actions.setPivot([field]);
      });

      const state = await getState(page);
      expect(state.mode).toBe('pivot');
      expect(state.rowVals.length).toBeGreaterThan(0);
      expect(state.colVals.length).toBeGreaterThan(0);

      if (pivotField === 'country') {
        expect(state.rowVals.map((row) => row.category)).toEqual(['Fruit', 'Vegetables']);
        expect(state.colVals).toEqual(['Canada', 'Japan', 'Mexico', 'United States']);
        expect(state.pivotMatrix[0][0].sum).toBe(30);
        expect(state.pivotMatrix[1][1].sum).toBe(40);
        expect(state.pivotGrandTotal.sum).toBe(360);
      }
    });
  }
});