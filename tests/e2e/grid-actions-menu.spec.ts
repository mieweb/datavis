import { expect, test } from '@playwright/test';

import { gotoHarness } from './helpers';

test.describe('Grid actions menu', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('is hidden while controls are visible and returns when they close', async ({ page }) => {
    await gotoHarness(page, 'default', { mode: 'default' });

    const gridActions = page.getByRole('button', { name: 'Grid actions' });
    await expect(gridActions).toBeVisible();
    await gridActions.click();
    const menu = page.locator('[data-slot="dropdown-menu"]');
    await expect(menu).toBeVisible();

    await menu.getByRole('button', { name: 'Controls' }).click();
    await expect(menu).toHaveCount(0);
    await expect(gridActions).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Add aggregate/ })).toBeVisible();

    await page.getByRole('button', { name: 'Controls' }).click();
    await expect(page.getByRole('combobox', { name: /Add aggregate/ })).toHaveCount(0);
    await expect(gridActions).toBeVisible();
  });
});
