import { expect, test } from '@playwright/test';

import { expectRowCount, getState, gotoHarness, runAction } from './helpers';

test.describe('Legacy Core Ports', () => {
  test('filter.js: department dropdown filtering updates visible rows', async ({ page }) => {
    await gotoHarness(page, 'default');

    await runAction(page, () => {
      window.__wcdv!.actions.setFilter({
        department: { $in: ['Engineering'] },
      });
    });

    await expectRowCount(page, 3);
    const state = await getState(page);
    expect(state.visibleRows.map((row) => row.name)).toEqual([
      'Alice Johnson',
      'Charlie Brown',
      'Grace Lee',
    ]);
  });

  test('date_filter.js: date comparison filters the simple dataset', async ({ page }) => {
    await gotoHarness(page, 'default');

    await runAction(page, () => {
      window.__wcdv!.actions.setFilter({
        hireDate: { $gte: '2020-01-01' },
      });
    });

    await expectRowCount(page, 5);
  });

  test('sort.js: ascending and descending sort work for numeric columns', async ({ page }) => {
    await gotoHarness(page, 'default');

    await runAction(page, () => {
      window.__wcdv!.actions.setSort('salary', 'ASC');
    });

    let state = await getState(page);
    expect(state.visibleRows[0].name).toBe('Eve Torres');
    expect(state.visibleRows.at(-1)?.name).toBe('Charlie Brown');

    await runAction(page, () => {
      window.__wcdv!.actions.setSort('salary', 'DESC');
    });

    state = await getState(page);
    expect(state.visibleRows[0].name).toBe('Charlie Brown');
    expect(state.visibleRows.at(-1)?.name).toBe('Eve Torres');
  });

  test('aggregate.js: grouped aggregates are computed for grouped rows and totals', async ({ page }) => {
    await gotoHarness(page, 'default');

    await runAction(page, () => {
      window.__wcdv!.actions.setGroup(['department']);
    });
    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'sum', fields: ['salary'] }]);
    });

    const state = await getState(page);
    expect(state.mode).toBe('group');
    expect(state.groupFields).toEqual(['department']);
    expect(state.totalAggregates['sum(salary)']).toBe(910000);

    const departmentEntries = Object.values(state.groupMetadata) as Array<{ groupValues: { department: string }; aggregates: Record<string, number> }>;
    const engineering = departmentEntries.find((entry) => entry.groupValues.department === 'Engineering');
    expect(engineering?.aggregates['sum(salary)']).toBe(370000);
  });

  test('footer.js: plain-table totals render after aggregate selection', async ({ page }) => {
    await gotoHarness(page, 'default');

    await runAction(page, () => {
      window.__wcdv!.actions.setAggregate([{ fn: 'sum', fields: ['salary'] }]);
    });

    await expect(page.getByText('910,000')).toBeVisible();
  });

  test('selection.js: clicking a row updates table selection state', async ({ page }) => {
    await gotoHarness(page, 'default');

    await page.locator('tbody tr').nth(0).click();

    await expect.poll(async () => (await getState(page)).selectedRows).toEqual([0]);
  });

  test('active-row.js: keyboard navigation wraps from first to last row', async ({ page }) => {
    await gotoHarness(page, 'default');

    const table = page.locator('.wcdv-plain-table[tabindex="0"]');
    await table.focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await getState(page)).selectedRows).toEqual([0]);

    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => (await getState(page)).selectedRows).toEqual([7]);
  });

  test('number-format-str.js: numeric cells retain locale grouping separators', async ({ page }) => {
    await gotoHarness(page, 'default');

    await expect(page.getByText('125,000').first()).toBeVisible();
  });

  test('colconfig.js: column configuration dialog can be opened from the toolbar', async ({ page }) => {
    await gotoHarness(page, 'default');

    await page.getByRole('button', { name: /^Columns$/ }).click();
    await expect(page.getByRole('dialog', { name: 'Column Configuration' })).toBeVisible();
  });
});