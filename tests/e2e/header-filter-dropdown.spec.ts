import { expect, test } from '@playwright/test';

import { getState, gotoHarness } from './helpers';

/**
 * In-place header filter popup (HeaderFilterDropdown).
 *
 * Clicking a string column's funnel opens a searchable value-checklist
 * ($in) dropdown so users can filter without opening the controls panel.
 * Checking values narrows the view; clearing them restores every row.
 */
test.describe('Header filter dropdown', () => {
  // The popup is a fixed-position body portal; a taller viewport keeps every
  // checklist option within bounds (fixed elements can't be scrolled into view).
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('funnel value-checklist filters string column in place', async ({ page }) => {
    await gotoHarness(page, 'default');
    const { rowCount: total } = await getState(page);

    // Open the Department funnel popup
    await page.getByRole('button', { name: 'Add filter for Department' }).click();

    // String columns render a multi-select value checklist ($in)
    const engineering = page.getByRole('menuitemcheckbox', { name: 'Engineering' });
    await expect(engineering).toBeVisible();
    await engineering.click();

    // View narrows to the Engineering rows (Alice, Charlie, Grace)
    await expect.poll(async () => (await getState(page)).rowCount).toBe(3);
    for (const row of (await getState(page)).visibleRows) {
      expect(row.department).toBe('Engineering');
    }

    // Unchecking the value restores the full row set
    await engineering.click();
    await expect.poll(async () => (await getState(page)).rowCount).toBe(total);
  });

  test('funnel checklist supports selecting multiple values', async ({ page }) => {
    await gotoHarness(page, 'default');

    await page.getByRole('button', { name: 'Add filter for Department' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Engineering' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Finance' }).click();

    // Engineering (3) + Finance (2) = 5 rows
    await expect.poll(async () => (await getState(page)).rowCount).toBe(5);
    for (const row of (await getState(page)).visibleRows) {
      expect(['Engineering', 'Finance']).toContain(row.department);
    }
  });
});
