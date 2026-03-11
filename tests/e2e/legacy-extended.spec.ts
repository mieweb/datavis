import { expect, test } from '@playwright/test';

import { getState, gotoHarness, runAction } from './helpers';

test.describe('Legacy Extended Ports', () => {
  test('allowHtml.js: configured HTML cells render safe links', async ({ page }) => {
    await gotoHarness(page, 'allow-html');

    const link = page.getByRole('link', { name: 'Example Docs' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com/docs');
  });

  test('format-strings.js: inline formatting markers render styled content', async ({ page }) => {
    await gotoHarness(page, 'format-strings');

    const formatted = page.locator('.wcdv-format-string');
    await expect(formatted).toHaveText('Important');
    await expect(formatted).toHaveCSS('font-weight', '700');
  });

  test('operations.js: operations palette exposes grouped actions', async ({ page }) => {
    await gotoHarness(page, 'operations');

    await expect(page.getByRole('toolbar', { name: 'Operations' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('operation-log')).toContainText('Delete');
  });

  test('group-funs.js: date group functions transform group values', async ({ page }) => {
    await gotoHarness(page, 'group-funs');

    await runAction(page, () => {
      window.__wcdv!.actions.setGroupSpec([{ field: 'hireDate', fun: 'year' }]);
    });

    const state = await getState(page);
    const years = Object.values(state.groupMetadata).map((entry) => {
      const value = entry as { groupValues: { hireDate: string } };
      return value.groupValues.hireDate;
    }).sort();

    expect(years).toEqual(['2017', '2018', '2019', '2020', '2021', '2022', '2023']);
  });

  test('multi-grid.js: multiple grid instances render independently on one page', async ({ page }) => {
    await page.goto('/?e2e=multi-grid');

    await expect(page.getByRole('region', { name: 'Default Harness Grid' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Wide Harness Grid' })).toBeVisible();
    await expect(page.locator('.wcdv-grid')).toHaveCount(2);
  });

  test('dnd.js: column headers can be reordered via drag and drop', async ({ page }) => {
    await gotoHarness(page, 'default');

    const headerTexts = async () => page.locator('thead th').evaluateAll((elements) =>
      elements.map((element) => element.textContent?.replace(/↕|↑|↓/g, '').trim()).filter(Boolean),
    );

    const nameHeader = page.locator('th').filter({
      has: page.getByRole('button', { name: 'Sort by Name', exact: true }),
    }).first();
    const managerHeader = page.locator('th').filter({
      has: page.getByRole('button', { name: 'Sort by Manager', exact: true }),
    }).first();

    const before = await headerTexts();
    const sourceBox = await nameHeader.boundingBox();
    const targetBox = await managerHeader.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 16 });
    await page.mouse.up();

    const headers = await headerTexts();

    expect(headers).not.toEqual(before);
    expect(headers.indexOf('Name')).toBeGreaterThan(before.indexOf('Name'));
  });
});