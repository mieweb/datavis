import { expect, test } from '@playwright/test';

import { getState, gotoHarness } from './helpers';

test.describe('Column drag into hidden controls', () => {
  test('keeps the active drag stable while controls open and drops into Group', async ({ page }) => {
    await gotoHarness(page, 'default', { mode: 'default' });

    const header = page.getByRole('columnheader', { name: /Sort by Department/ });
    const groupDropZone = page.getByRole('group', { name: 'Group' });
    const headerTop = await header.evaluate((element) => element.getBoundingClientRect().top);
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

    await header.dispatchEvent('dragstart', { dataTransfer });

    await expect(page.getByLabel('Data controls')).toBeVisible();
    expect(await header.evaluate((element) => element.getBoundingClientRect().top)).toBe(headerTop);

    await groupDropZone.dispatchEvent('dragover', { dataTransfer });
    await groupDropZone.dispatchEvent('drop', { dataTransfer });

    await expect.poll(async () => (await getState(page)).groupFields).toEqual(['department']);
  });
});