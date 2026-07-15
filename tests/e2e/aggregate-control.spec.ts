import { expect, test } from '@playwright/test';

import { getState, gotoHarness } from './helpers';

/**
 * The aggregate control must work outside `mode="full"`. Previously, selecting a
 * function (e.g. Sum) in default/minimal mode left no entry to attach a field to
 * and pushed an empty-field aggregate the view rejected ("Invalid Aggregate …
 * unknown field"). It now stays put until a field is picked, then applies.
 */

/** Open the controls panel via the hamburger menu (hidden by default in default mode). */
async function openControlsViaMenu(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Grid actions' }).first().click();
  await expect(page.locator('[data-slot="dropdown-menu"]')).toBeVisible();
  await page
    .locator('[data-slot="dropdown-menu"]')
    .getByRole('button', { name: 'Controls' })
    .click();
}

test.describe('Aggregate control in default mode', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('aggregate applies only after a field is picked and never errors', async ({ page }) => {
    const invalidAggregateErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Invalid Aggregate/i.test(msg.text())) {
        invalidAggregateErrors.push(msg.text());
      }
    });

    await gotoHarness(page, 'default', { mode: 'default' });
    await openControlsViaMenu(page);

    // Group by Department so the aggregate has groups to summarize.
    await page
      .getByRole('group', { name: 'Group' })
      .getByRole('button', { name: /Add field/ })
      .click();
    await page.getByRole('menuitem', { name: /Department/ }).click();
    await expect.poll(async () => (await getState(page)).mode).toBe('group');

    // Select the Sum function. Because it needs a field, it must NOT commit yet
    // — instead it leaves an entry with a field picker (the regression: this row
    // used to vanish immediately in default/minimal mode).
    await page.getByRole('combobox', { name: /Add aggregate/ }).click();
    await page.getByRole('option', { name: 'Sum', exact: true }).click();
    const sumField = page.getByRole('combobox', { name: /Sum field/ });
    await expect(sumField).toBeVisible();

    // No aggregate should have been pushed to the view while the field is empty.
    expect(invalidAggregateErrors).toEqual([]);

    // Pick the field — now the aggregate commits and the group totals render.
    await sumField.click();
    await page.getByRole('option', { name: 'Salary' }).click();

    // Engineering: 125,000 + 140,000 + 105,000 = 370,000.
    await expect(page.getByText('370,000').first()).toBeVisible();
    expect(invalidAggregateErrors).toEqual([]);
  });
});

test.describe('Aggregate control in minimal mode', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('aggregate entry persists so a field can be chosen', async ({ page }) => {
    const invalidAggregateErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Invalid Aggregate/i.test(msg.text())) {
        invalidAggregateErrors.push(msg.text());
      }
    });

    await gotoHarness(page, 'default', { mode: 'minimal' });

    // Minimal mode shows the controls panel by default (no title bar to host a
    // toggle), so interact with it directly.
    await expect(page.getByRole('combobox', { name: /Add aggregate/ })).toBeVisible();

    await page
      .getByRole('group', { name: 'Group' })
      .getByRole('button', { name: /Add field/ })
      .click();
    await page.getByRole('menuitem', { name: /Department/ }).click();
    await expect.poll(async () => (await getState(page)).mode).toBe('group');

    await page.getByRole('combobox', { name: /Add aggregate/ }).click();
    await page.getByRole('option', { name: 'Sum', exact: true }).click();

    // The regression: in minimal mode the entry was wiped on the next sync.
    await expect(page.getByRole('combobox', { name: /Sum field/ })).toBeVisible();
    expect(invalidAggregateErrors).toEqual([]);
  });
});
