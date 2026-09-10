import { expect, test } from '@playwright/test';
import { getState, gotoHarness } from './helpers';

test('perspective pills switch perspectives with one click', async ({ page }) => {
  await gotoHarness(page, 'default', { prefs: 'true' });
  await expect.poll(async () => (await getState(page)).prefsReady).toBe(true);

  const toolbar = page.getByRole('toolbar', { name: 'Preferences' });
  const perspectiveSelect = toolbar.getByRole('combobox', { name: 'Perspective' });
  const initialPerspectiveName = (await perspectiveSelect.textContent())?.trim();

  expect(initialPerspectiveName).toBeTruthy();
  await toolbar.getByRole('button', { name: `Pin ${initialPerspectiveName}` }).click();

  const titleBar = page.locator('.wcdv-title-bar');
  const pinnedPerspectives = titleBar.getByRole('group', { name: 'Pinned perspectives' });
  const initialPerspectivePill = pinnedPerspectives.getByRole('button', {
    name: initialPerspectiveName!,
  });
  await expect(initialPerspectivePill).toHaveAttribute('aria-pressed', 'true');
  await expect(titleBar.locator('.wcdv-title-perspectives')).toContainText(initialPerspectiveName!);
  await expect.poll(async () => titleBar.evaluate((element) => {
    const help = element.querySelector('[aria-label="Help"]');
    const pills = element.querySelector('.wcdv-perspective-pills');
    const preferences = element.querySelector('.wcdv-prefs-toolbar');
    if (!help || !pills || !preferences) return false;
    return Boolean(help.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_FOLLOWING)
      && Boolean(pills.compareDocumentPosition(preferences) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  page.once('dialog', (dialog) => dialog.accept('Review'));
  await perspectiveSelect.click();
  await page.getByRole('option', { name: /New Perspective/ }).click();

  await expect(perspectiveSelect).toHaveText('Review');
  await toolbar.getByRole('button', { name: 'Pin Review' }).click();
  const reviewPerspectivePill = pinnedPerspectives.getByRole('button', { name: 'Review' });
  await expect(reviewPerspectivePill).toHaveAttribute('aria-pressed', 'true');

  await initialPerspectivePill.click();

  await expect(perspectiveSelect).toHaveText(initialPerspectiveName!);
  await expect(initialPerspectivePill).toHaveAttribute('aria-pressed', 'true');
  await expect(reviewPerspectivePill).toHaveAttribute('aria-pressed', 'false');

  await gotoHarness(page, 'default', { prefs: 'true' });
  await expect.poll(async () => (await getState(page)).prefsReady).toBe(true);
  await expect(
    page.getByRole('group', { name: 'Pinned perspectives' }).getByRole('button', {
      name: initialPerspectiveName!,
    }),
  ).toBeVisible();
});

test('pinning from the hamburger menu renders the pill in the title area', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await gotoHarness(page, 'default', { prefs: 'true', mode: 'default' });
  await expect.poll(async () => (await getState(page)).prefsReady).toBe(true);

  await page.getByRole('button', { name: 'Grid actions' }).click();
  const menu = page.locator('[data-slot="dropdown-menu"]');
  await expect(menu).toBeVisible();
  const toolbar = menu.locator('.wcdv-prefs-toolbar');
  const perspectiveSelect = toolbar.getByRole('combobox', { name: 'Perspective' });
  const perspectiveName = (await perspectiveSelect.textContent())!.trim();

  await toolbar.getByRole('button', { name: `Pin ${perspectiveName}` }).click();

  const titlePills = page.locator('.wcdv-title-perspectives');
  await expect(
    titlePills.getByRole('button', { name: perspectiveName }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    toolbar.getByRole('group', { name: 'Pinned perspectives' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Grid actions' }).click();
  await expect(menu).toBeHidden();
  await expect(
    titlePills.getByRole('button', { name: perspectiveName }),
  ).toBeVisible();
});

test('creates consecutive perspectives from the hamburger menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await gotoHarness(page, 'default', { prefs: 'true', mode: 'default' });
  await expect.poll(async () => (await getState(page)).prefsReady).toBe(true);

  await page.getByRole('button', { name: 'Grid actions' }).click();
  const menu = page.locator('[data-slot="dropdown-menu"]');
  const perspectiveSelect = menu.getByRole('combobox', { name: 'Perspective' });

  for (const perspectiveName of ['Review', 'Follow Up']) {
    page.once('dialog', (dialog) => dialog.accept(perspectiveName));
    await perspectiveSelect.click();
    await page.getByRole('option', { name: /New Perspective/ }).click();
    await expect(perspectiveSelect).toHaveText(perspectiveName);
    await expect(menu).toBeVisible();
  }
});