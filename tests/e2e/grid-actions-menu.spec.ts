import { expect, test } from '@playwright/test';

test.describe('Grid actions menu', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('is hidden after leaving minimal mode', async ({ page }) => {
    await page.goto('/');

    const displayMode = page.getByRole('combobox', { name: 'Grid display mode' });
    await expect(displayMode).toBeVisible();

    await displayMode.selectOption('minimal');
    const gridActions = page.getByRole('button', { name: 'Grid actions' });
    await expect(gridActions).toBeVisible();
    await gridActions.click();
    await expect(page.locator('[data-slot="dropdown-menu"]')).toBeVisible();

    await displayMode.selectOption('default');
    await expect(page.locator('[data-slot="dropdown-menu"]')).toHaveCount(0);
    await expect(gridActions).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Controls' })).toBeVisible();
  });
});
