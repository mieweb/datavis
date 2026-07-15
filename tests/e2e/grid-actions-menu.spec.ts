import { expect, test } from '@playwright/test';

import { gotoHarness } from './helpers';

/**
 * The hamburger grid-actions menu must close when an action is selected.
 * Previously, opening it and clicking the gear (controls) left the menu open
 * even though the same buttons move inline into the title bar once controls
 * open.
 */
test.describe('Grid actions menu', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('closes after clicking the controls gear', async ({ page }) => {
    await gotoHarness(page, 'default', { mode: 'default' });

    // Open the hamburger — the dropdown popup appears.
    await page.getByRole('button', { name: 'Grid actions' }).first().click();
    const menu = page.locator('[data-slot="dropdown-menu"]');
    await expect(menu).toBeVisible();

    // Click the gear (Controls) inside the popup.
    await menu.getByRole('button', { name: 'Controls' }).click();

    // The menu must close (its buttons now live inline in the title bar), and
    // the controls panel — proven by the aggregate combobox — is now visible.
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Add aggregate/ })).toBeVisible();
  });
});
