import { expect, test } from '@playwright/test';

import { getState, gotoHarness, runAction } from './helpers';

test.describe('Legacy Scenario Expanded', () => {
  test('selection.js: clicking a grouped row selects all rows in that group', async ({ page }) => {
    await gotoHarness(page, 'matrix');

    await runAction(page, () => {
      window.__wcdv!.actions.setGroup(['category']);
    });

    await page.getByRole('gridcell', { name: 'Fruit' }).first().click();
    await expect.poll(async () => (await getState(page)).selectedRows.length).toBe(6);
  });

  test('active-row.js: pressing Enter on an active row opens a detail panel', async ({ page }) => {
    await gotoHarness(page, 'default');

    const table = page.locator('.wcdv-plain-table[tabindex="0"]');
    await table.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog', { name: /detail panel/i })).toBeVisible();
  });

  test('omnifilter.js: clear button restores the full result count', async ({ page }) => {
    await page.goto('/?e2e=omnifilter');

    await page.getByRole('button', { name: 'Toggle Omnifilter' }).click();
    await page.getByLabel('Omnifilter input').fill('engineering');
    await expect(page.getByTestId('omnifilter-count')).toHaveText('3');
    await page.getByRole('button', { name: 'Clear omnifilter' }).click();
    await expect(page.getByTestId('omnifilter-count')).toHaveText('8');
  });

  test('pagination.js: current page button is marked as current', async ({ page }) => {
    await page.goto('/?e2e=pagination');

    await page.getByRole('button', { name: '3' }).click();
    await expect(page.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page');
  });

  test('prefs.js: back and forward traverse perspective history', async ({ page }) => {
    await page.goto('/?e2e=prefs');

    await page.getByRole('button', { name: 'New' }).click();
    await expect(page.getByTestId('current-perspective')).toContainText('Perspective 1');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('current-perspective')).toContainText('Main Perspective');
    await page.getByRole('button', { name: 'Forward' }).click();
    await expect(page.getByTestId('current-perspective')).toContainText('Perspective 1');
  });

  test('no-auto-save.js: explicit save persists the changed state across reload', async ({ page }) => {
    await page.goto('/?e2e=no-auto-save');

    await page.getByLabel('Group by department').check();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.reload();
    await expect(page.getByLabel('Group by department')).toBeChecked();
  });

  test('sourceParams.js: checkbox-only filtering narrows rows independently', async ({ page }) => {
    await page.goto('/?e2e=source-params');

    await page.getByLabel('Active only').check();
    await expect(page.getByTestId('source-param-count')).toHaveText('6');
  });

  test('google-chart.js: stacked toggle changes chart layout mode', async ({ page }) => {
    await page.goto('/?e2e=google-chart');

    const bar = page.getByTestId('chart-bar-Engineering');
    await expect(bar).toHaveCSS('display', 'inline-block');
    await page.getByRole('button', { name: 'Toggle Stacked' }).click();
    await expect(bar).toHaveCSS('display', 'block');
  });

  test('auto-limit.js: warning reappears when the filter is cleared', async ({ page }) => {
    await page.goto('/?e2e=auto-limit');

    await page.getByLabel('Auto limit filter').fill('Eve');
    await expect(page.getByTestId('auto-limit-warning')).toBeHidden();
    await page.getByLabel('Auto limit filter').fill('');
    await expect(page.getByTestId('auto-limit-warning')).toBeVisible();
  });
});