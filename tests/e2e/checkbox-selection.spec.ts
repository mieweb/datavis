import { expect, test } from '@playwright/test';

import { getState, gotoHarness, runAction } from './helpers';

/**
 * Checkbox row selection (features.rowSelection === 'checkbox').
 *
 * Exercises the PlainTable leading checkbox column + useRowSelection hook:
 * - individual checkboxes accumulate selections
 * - the header checkbox is tri-state (none / some / all)
 * - select-all applies to the currently rendered (filtered) rows and
 *   preserves selections hidden by a filter
 */
test.describe('Checkbox row selection', () => {
  test('individual checkboxes accumulate selections', async ({ page }) => {
    await gotoHarness(page, 'checkbox');

    const rowCheckboxes = page.getByRole('checkbox', { name: 'Select row' });
    await rowCheckboxes.nth(0).check();
    await rowCheckboxes.nth(2).check();

    await expect
      .poll(async () => (await getState(page)).selectedRows.slice().sort((a, b) => a - b))
      .toEqual([0, 2]);

    // Toggling a checked row removes it (accumulative, no Shift needed)
    await rowCheckboxes.nth(0).uncheck();
    await expect
      .poll(async () => (await getState(page)).selectedRows)
      .toEqual([2]);
  });

  test('header checkbox selects and clears every rendered row (tri-state)', async ({ page }) => {
    await gotoHarness(page, 'checkbox');

    const { rowCount } = await getState(page);
    const selectAll = page.getByRole('checkbox', { name: 'Select all rows' });

    // none -> all
    await selectAll.check();
    await expect
      .poll(async () => (await getState(page)).selectedRows.length)
      .toBe(rowCount);

    // Unchecking one rendered row moves the header to the indeterminate state
    await page.getByRole('checkbox', { name: 'Select row' }).nth(0).uncheck();
    await expect(selectAll).toHaveJSProperty('indeterminate', true);
    await expect
      .poll(async () => (await getState(page)).selectedRows.length)
      .toBe(rowCount - 1);

    // all (via header) -> none
    await selectAll.check();
    await selectAll.uncheck();
    await expect
      .poll(async () => (await getState(page)).selectedRows.length)
      .toBe(0);
  });

  test('select-all applies to the currently rendered (filtered) rows', async ({ page }) => {
    await gotoHarness(page, 'checkbox');
    const { rowCount: total } = await getState(page);

    // Narrow the view to Engineering rows via the harness filter action
    await runAction(page, () => {
      window.__wcdv!.actions.setFilter({ department: { $eq: 'Engineering' } });
    });
    const filtered = (await getState(page)).rowCount;
    expect(filtered).toBeLessThan(total);

    // Header select-all picks exactly the filtered rows now on screen
    await page.getByRole('checkbox', { name: 'Select all rows' }).check();
    await expect
      .poll(async () => (await getState(page)).selectedRows.length)
      .toBe(filtered);

    // Clearing via the header empties the selection
    await page.getByRole('checkbox', { name: 'Select all rows' }).uncheck();
    await expect
      .poll(async () => (await getState(page)).selectedRows.length)
      .toBe(0);
  });
});
