import { expect, test } from '@playwright/test';

import { checkA11y, getState, gotoHarness, runActionWithArg } from './helpers';

const searchInputName = 'Filter all rows by text';

test.describe('Plain-mode global search', () => {
  test('filters and highlights displayed values without running ACE work', async ({ page }) => {
    await gotoHarness(page, 'default');
    const initialState = await getState(page);
    const input = page.getByLabel(searchInputName);

    await input.fill('ENGINEERING');

    await expect(page.getByTestId('global-search-count')).toHaveText('3 rows');
    await expect(page.locator('tbody tr[data-row-num]')).toHaveCount(3);
    await expect(page.locator('mark.wcdv-search-match')).toHaveCount(3);
    expect((await getState(page)).revision).toBe(initialState.revision);
    expect((await getState(page)).rowCount).toBe(8);
  });

  test('announces zero results and Escape restores the ACE result', async ({ page }) => {
    await gotoHarness(page, 'default');
    const input = page.getByLabel(searchInputName);
    const status = page.getByTestId('global-search-count');

    await input.fill('not-in-this-dataset');
    await expect(status).toHaveText('0 rows');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(page.locator('tbody tr[data-row-num]')).toHaveCount(0);

    await input.press('Escape');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(status).toHaveText('8 rows');
    await expect(page.locator('tbody tr[data-row-num]')).toHaveCount(8);
  });

  test('preserves every keystroke when typing crosses debounce boundaries', async ({ page }) => {
    await gotoHarness(page, 'default');
    const input = page.getByLabel(searchInputName);

    await input.pressSequentially('tex', { delay: 120 });

    await expect(input).toHaveValue('tex');
    await expect(page.getByTestId('global-search-count')).toHaveAttribute('aria-busy', 'false');
  });

  test('rebuilds against visible columns without running ACE work', async ({ page }) => {
    await gotoHarness(page, 'default');
    const input = page.getByLabel(searchInputName);

    await input.fill('Frank Garcia');
    await expect(page.getByTestId('global-search-count')).toHaveText('2 rows');
    const revisionBeforeHide = (await getState(page)).revision;

    await page.getByRole('columnheader', { name: /Sort by Manager/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Hide Column' }).click();

    await expect(page.getByTestId('global-search-count')).toHaveText('1 row');
    await expect(page.locator('tbody tr[data-row-num]')).toHaveCount(1);
    await expect(page.getByRole('grid')).toContainText('Frank Garcia');
    expect((await getState(page)).revision).toBe(revisionBeforeHide);
  });

  test('narrows an ACE column filter and clears independently', async ({ page }) => {
    await gotoHarness(page, 'default');
    await page.getByRole('button', { name: 'Add filter for Department' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Engineering' }).click();
    await expect.poll(async () => (await getState(page)).rowCount).toBe(3);

    const filteredState = await getState(page);
    const search = page.getByRole('search');
    const input = search.getByLabel(searchInputName);
    await input.fill('Grace');
    await expect(page.getByTestId('global-search-count')).toHaveText('1 row');
    expect((await getState(page)).filterSpec).toEqual(filteredState.filterSpec);

    await search.getByRole('button', { name: 'Clear filter' }).click();
    await expect(page.getByTestId('global-search-count')).toHaveText('3 rows');
    expect((await getState(page)).filterSpec).toEqual(filteredState.filterSpec);
  });

  test('title-bar clear removes both global search and ACE column filters', async ({ page }) => {
    await gotoHarness(page, 'default');
    await page.getByRole('button', { name: 'Add filter for Department' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Engineering' }).click();
    await expect.poll(async () => (await getState(page)).rowCount).toBe(3);

    const input = page.getByLabel(searchInputName);
    await input.fill('Grace');
    await expect(page.getByTestId('global-search-count')).toHaveText('1 row');

    await page.locator('.wcdv-title-bar').getByRole('button', { name: 'clear filter' }).click();

    await expect(input).toHaveValue('');
    await expect(page.getByTestId('global-search-count')).toHaveText('8 rows');
    await expect.poll(async () => (await getState(page)).filterSpec).toBeNull();
  });

  test('is absent from grouped and pivot output and clears on mode change', async ({ page }) => {
    await gotoHarness(page, 'default');
    await page.getByLabel(searchInputName).fill('Diana Prince');
    await expect(page.getByTestId('global-search-count')).toHaveText('1 row');

    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await expect(page.getByLabel(searchInputName)).toHaveCount(0);

    await runActionWithArg(page, [], (fields) => window.__wcdv!.actions.setGroup(fields));
    await expect(page.getByLabel(searchInputName)).toHaveValue('');

    await runActionWithArg(page, ['name'], (fields) => window.__wcdv!.actions.setGroup(fields));
    await runActionWithArg(page, ['department'], (fields) => window.__wcdv!.actions.setPivot(fields));
    expect((await getState(page)).mode).toBe('pivot');
    await expect(page.getByLabel(searchInputName)).toHaveCount(0);
  });

  test('finds a formatted value beyond the first 100 rows in a 5K-row view', async ({ page }) => {
    await gotoHarness(page, 'large');
    const initialRevision = (await getState(page)).revision;

    await page.getByLabel(searchInputName).fill('104,999');

    await expect(page.getByTestId('global-search-count')).toHaveText('1 row');
    await expect(page.getByRole('grid')).toContainText('104,999');
    expect((await getState(page)).revision).toBe(initialRevision);
  });

  test('has no new automated accessibility violations', async ({ page }) => {
    await gotoHarness(page, 'default');
    await page.getByLabel(searchInputName).fill('Engineering');
    await expect(page.getByTestId('global-search-count')).toHaveText('3 rows');

    expect(await checkA11y(page, ['color-contrast'])).toEqual([]);
  });

  test('wraps at narrow widths and preserves keyboard order', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await gotoHarness(page, 'default');
    const search = page.getByRole('search');
    const input = search.getByLabel(searchInputName);

    await input.fill('Engineering');
    await expect(page.getByTestId('global-search-count')).toHaveText('3 rows');
    await input.focus();
    await page.keyboard.press('Tab');
    await expect(search.getByRole('button', { name: 'Clear filter' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(input).toBeFocused();

    const toolbarFits = await page.getByRole('toolbar', { name: 'Grid Toolbar' }).evaluate(
      (toolbar) => toolbar.scrollWidth <= toolbar.clientWidth,
    );
    expect(toolbarFits).toBe(true);
  });
});