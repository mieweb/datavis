import { expect, test } from '@playwright/test';

test.describe('Legacy Scenario Ports', () => {
  test('auto-limit.js: warning appears when result set exceeds the auto limit', async ({ page }) => {
    await page.goto('/?e2e=auto-limit');

    await expect(page.getByTestId('auto-limit-warning')).toBeVisible();
    await page.getByLabel('Auto limit filter').fill('Eve');
    await expect(page.getByTestId('auto-limit-warning')).toBeHidden();
  });

  test('cancel.js: cancelling a load restores the not-loaded state', async ({ page }) => {
    await page.goto('/?e2e=cancel');

    await page.getByRole('button', { name: 'Load' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('cancel-status')).toHaveText('not loaded');
  });

  test('drilldown.js: clicking a pivot summary opens drilldown details', async ({ page }) => {
    await page.goto('/?e2e=drilldown');

    await page.getByRole('button', { name: 'Canada / Engineering / Count 1' }).click();
    await expect(page.getByTestId('drilldown-panel')).toContainText('Row IDs: 1');
  });

  test('google-chart.js: chart scenario renders a titled visualization with bar data', async ({ page }) => {
    await page.goto('/?e2e=google-chart');

    await expect(page.getByRole('heading', { name: 'Department Totals' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Department Totals chart' })).toBeVisible();
    await expect(page.getByTestId('chart-bar-Engineering')).toHaveAttribute('title', 'Engineering: 3');
  });

  test('no-auto-save.js: unsaved changes are marked and do not persist across reload without save', async ({ page }) => {
    await page.goto('/?e2e=no-auto-save');

    await page.getByLabel('Group by department').check();
    await expect(page.getByTestId('current-perspective')).toContainText('[*]');
    await page.reload();
    await expect(page.getByTestId('current-perspective')).not.toContainText('[*]');
  });

  test('omnifilter.js: global text search filters rows and escapes cleanly', async ({ page }) => {
    await page.goto('/?e2e=omnifilter');

    await page.getByRole('button', { name: 'Toggle Omnifilter' }).click();
    const input = page.getByLabel('Omnifilter input');
    await input.fill('engineering');
    await expect(page.getByTestId('omnifilter-count')).toHaveText('3');
    await input.press('Escape');
    await expect(input).toBeHidden();
  });

  test('pagination.js: changing page changes the visible slice of rows', async ({ page }) => {
    await page.goto('/?e2e=pagination');

    await page.getByRole('button', { name: '2' }).click();
    await expect(page.getByRole('grid')).toContainText('Diana Prince');
    await expect(page.getByRole('grid')).not.toContainText('Alice Johnson');
  });

  test('prefs.js: auto-saved perspective changes persist across reload', async ({ page }) => {
    await page.goto('/?e2e=prefs');

    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Group by department').check();
    await expect(page.getByTestId('current-perspective')).toContainText('Perspective 1');
    await page.reload();
    await expect(page.getByTestId('current-perspective')).toContainText('Perspective 1');
    await expect(page.getByLabel('Group by department')).toBeChecked();
  });

  test('row-customization.js: customized group headers render labels and colors', async ({ page }) => {
    await page.goto('/?e2e=row-customization');

    await expect(page.getByTestId('group-header-fruit')).toContainText('🍎 Fruit');
    await expect(page.getByTestId('group-header-vegetables')).toContainText('🥬 Vegetables');
    await expect(page.getByTestId('group-header-fruit')).toHaveCSS('color', 'rgb(220, 38, 38)');
  });

  test('sourceParams.js: form inputs narrow the displayed dataset', async ({ page }) => {
    await page.goto('/?e2e=source-params');

    await page.getByLabel('Department source param').selectOption('Engineering');
    await page.getByLabel('Active only').check();
    await expect(page.getByTestId('source-param-count')).toHaveText('2');
  });
});