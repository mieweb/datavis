import { expect, test } from '@playwright/test';
import { getState, gotoHarness, runAction, runActionWithArg, waitForIdle } from './helpers';

test.describe('Aggregate cell drill-down', () => {
  test('double-clicking a grouped aggregate shows the group rows in plain output', async ({ page }) => {
    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'sum', fields: ['salary'] }]);
    });

    const previousRevision = (await getState(page)).revision;
    await page
      .locator('.wcdv-group-header')
      .filter({ hasText: 'Engineering' })
      .locator('[data-drilldown-cell]')
      .first()
      .dblclick();
    await waitForIdle(page, previousRevision);

    const drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.visibleRows).toHaveLength(3);
    expect(drillDownState.visibleRows.every((row) => row.department === 'Engineering')).toBe(true);
  });

  test('double-clicking a pivot aggregate shows its contributing plain rows', async ({ page }) => {
    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'count', fields: [] }]);
    });
    await runActionWithArg(page, ['active'], (fields) => window.__wcdv!.actions.setPivot(fields));

    const pivotState = await getState(page);
    const rowIndex = pivotState.rowVals.findIndex((row) => row.department === 'Engineering');
    const colIndex = pivotState.colVals.findIndex((value) => String(value) === 'true');
    expect(rowIndex).toBeGreaterThanOrEqual(0);
    expect(colIndex).toBeGreaterThanOrEqual(0);

    const previousRevision = pivotState.revision;
    await page.getByTestId(`pivot-aggregate-cell-${rowIndex}-${colIndex}-count`).dblclick();
    await waitForIdle(page, previousRevision);

    const drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.visibleRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Alice Johnson', department: 'Engineering', active: true }),
      expect.objectContaining({ name: 'Grace Lee', department: 'Engineering', active: true }),
    ]));
    expect(drillDownState.rowCount).toBe(2);
  });

  test('double-clicking a grouped total shows all contributing plain rows', async ({ page }) => {
    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'sum', fields: ['salary'] }]);
    });

    const previousRevision = (await getState(page)).revision;
    await page.locator('.wcdv-group-detail-table tbody tr').last().locator('[data-drilldown-cell]').first().dblclick();
    await waitForIdle(page, previousRevision);

    const drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.rowCount).toBe(8);
  });

  test('double-clicking pivot totals drills into their contributing rows', async ({ page }) => {
    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'count', fields: [] }]);
    });
    await runActionWithArg(page, ['active'], (fields) => window.__wcdv!.actions.setPivot(fields));

    const pivotState = await getState(page);
    const rowIndex = pivotState.rowVals.findIndex((row) => row.department === 'Engineering');
    const colIndex = pivotState.colVals.findIndex((value) => String(value) === 'true');
    expect(rowIndex).toBeGreaterThanOrEqual(0);
    expect(colIndex).toBeGreaterThanOrEqual(0);

    let previousRevision = pivotState.revision;
    await page.getByTestId(`pivot-row-total-cell-${rowIndex}-count`).dblclick();
    await waitForIdle(page, previousRevision);
    let drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.visibleRows).toHaveLength(3);
    expect(drillDownState.visibleRows.every((row) => row.department === 'Engineering')).toBe(true);

    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'count', fields: [] }]);
    });
    await runActionWithArg(page, ['active'], (fields) => window.__wcdv!.actions.setPivot(fields));

    previousRevision = (await getState(page)).revision;
    await page.getByTestId(`pivot-column-total-cell-${colIndex}-count`).dblclick();
    await waitForIdle(page, previousRevision);
    drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.visibleRows).toHaveLength(6);
    expect(drillDownState.visibleRows.every((row) => row.active === true)).toBe(true);
  });

  test('double-clicking a grand total shows all contributing plain rows', async ({ page }) => {
    await gotoHarness(page);
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'count', fields: [] }]);
    });
    await runActionWithArg(page, ['active'], (fields) => window.__wcdv!.actions.setPivot(fields));

    const previousRevision = (await getState(page)).revision;
    await page.getByTestId('pivot-grand-total-cell-count').dblclick();
    await waitForIdle(page, previousRevision);

    const drillDownState = await getState(page);
    expect(drillDownState.mode).toBe('plain');
    expect(drillDownState.rowCount).toBe(8);
  });
});