import { expect, test } from '@playwright/test';

test.describe('editable rows with eSheets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e=editable');
    await expect(page.getByRole('heading', { name: 'Markdown ticket index' })).toBeVisible();
  });

  test('updates the linked Markdown frontmatter from the row editor', async ({ page }) => {
    const firstRow = page.getByRole('row', { name: /tickets\/DV-24\.md/ });
    await firstRow.getByRole('button', { name: 'Edit row' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit ticket metadata' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Editable Markdown metadata');
    await dialog.getByRole('textbox', { name: 'Owner' }).fill('Jordan');
    await dialog.getByRole('button', { name: 'Save row' }).click();

    await expect(dialog).toBeHidden();
    await expect(firstRow).toContainText('Editable Markdown metadata');
    await expect(page.getByTestId('markdown-tickets/DV-24.md')).toContainText('title: Editable Markdown metadata');
    await expect(page.getByTestId('markdown-tickets/DV-24.md')).toContainText('owner: Jordan');
  });

  test('opens the editor from double-click and keyboard activation', async ({ page }) => {
    const secondRow = page.getByRole('row', { name: /tickets\/DV-31\.md/ });
    await secondRow.dblclick();
    await expect(page.getByRole('dialog', { name: 'Edit ticket metadata' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    const grid = page.getByRole('grid');
    await grid.focus();
    await grid.press('ArrowDown');
    await grid.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Edit ticket metadata' })).toBeVisible();
  });

  test('prevents saving invalid required fields', async ({ page }) => {
    await page.getByRole('row', { name: /tickets\/DV-24\.md/ }).getByRole('button', { name: 'Edit row' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit ticket metadata' });
    await dialog.getByRole('textbox', { name: 'Title' }).fill('');
    await dialog.getByRole('button', { name: 'Save row' }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('Correct the highlighted fields before saving.');
  });

  test('stages multiple changes for a grid-level batch save', async ({ page }) => {
    await page.goto('/?e2e=editable-batch');
    const firstRow = page.getByRole('row', { name: /tickets\/DV-24\.md/ });
    await firstRow.getByRole('button', { name: 'Edit row' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit ticket metadata' });
    await dialog.getByRole('textbox', { name: 'Owner' }).fill('Jordan');
    await dialog.getByRole('button', { name: 'Save row' }).click();

    await expect(firstRow).toContainText('Jordan');
    await expect(page.getByTestId('markdown-tickets/DV-24.md')).toContainText('owner: Taylor');
    const saveChanges = page.getByRole('button', { name: 'Save changes' });
    await expect(saveChanges).toBeVisible();
    await saveChanges.click();

    await expect(saveChanges).toBeHidden();
    await expect(page.getByTestId('markdown-tickets/DV-24.md')).toContainText('owner: Jordan');
  });
});