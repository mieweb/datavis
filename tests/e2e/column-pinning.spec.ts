import { expect, test } from '@playwright/test';

import { gotoHarness } from './helpers';

test.describe('Column Pinning', () => {
  test('pin column via context menu and verify sticky positioning on scroll', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Right-click the "Name" column header to open context menu
    const nameHeader = page.getByRole('columnheader', { name: /Sort by Name/ });
    await nameHeader.click({ button: 'right' });

    // Click "Pin Column"
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // The pinned column ("Name") should now be first in the header
    const firstHeader = page.locator('thead th').first();
    await expect(firstHeader).toContainText('Name');

    // Verify the first header has position: sticky
    const stickyStyle = await firstHeader.evaluate((el) => getComputedStyle(el).position);
    expect(stickyStyle).toBe('sticky');
  });

  test('unpin column via context menu', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Pin the "Name" column first
    const nameHeader = page.getByRole('columnheader', { name: /Sort by Name/ });
    await nameHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // Now right-click "Name" again — it should show "Unpin Column"
    const pinnedHeader = page.locator('thead th').first();
    await pinnedHeader.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Unpin Column' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Unpin Column' }).click();

    // After unpinning, no columns should have sticky positioning
    const firstHeader = page.locator('thead th').first();
    const style = await firstHeader.evaluate((el) => el.style.position);
    expect(style).not.toBe('sticky');

    // Right-click to verify it shows "Pin Column" (not "Unpin")
    await firstHeader.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Pin Column' })).toBeVisible();
  });

  test('pinned columns stay fixed during horizontal scroll', async ({ page }) => {
    await page.goto('/');
    // Switch to Wide (50 columns) tab for horizontal scroll testing
    await page.getByRole('tab', { name: /Wide/ }).click();

    // Pin the "ID" column
    const idHeader = page.getByRole('columnheader', { name: /Sort by ID/ });
    await idHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // Pin the "First Name" column
    const fnHeader = page.getByRole('columnheader', { name: /Sort by First Name/ });
    await fnHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // Scroll the table right
    const scrollContainer = page.getByTestId('plain-table-scroll');
    await scrollContainer.evaluate((el) => { el.scrollLeft = 600; });

    // The first two headers should still be ID and First Name (sticky)
    const headers = page.locator('thead th');
    await expect(headers.nth(0)).toContainText('ID');
    await expect(headers.nth(1)).toContainText('First Name');

    // Verify sticky left offsets are set
    const idLeft = await headers.nth(0).evaluate((el) => el.style.left);
    expect(idLeft).toBe('0px');
    const fnLeft = await headers.nth(1).evaluate((el) => el.style.left);
    // First Name's left offset should match ID column's actual width
    expect(parseInt(fnLeft)).toBeGreaterThan(0);
  });

  test('pin separator shadow is visible on last pinned column', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Pin "Name" column
    const nameHeader = page.getByRole('columnheader', { name: /Sort by Name/ });
    await nameHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // The first header (Name, now pinned) should have the separator class
    const firstHeader = page.locator('thead th').first();
    await expect(firstHeader).toHaveClass(/wcdv-pin-separator/);

    // The first body cell in the first row should also have the separator
    const firstBodyCell = page.locator('tbody tr').first().locator('td').first();
    await expect(firstBodyCell).toHaveClass(/wcdv-pin-separator/);
  });

  test('column config dialog shows pin checkbox', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Pin "Name" column first
    const nameHeader = page.getByRole('columnheader', { name: /Sort by Name/ });
    await nameHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // Open column config dialog
    await page.getByRole('button', { name: /^Columns$/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Column Configuration' });
    await expect(dialog).toBeVisible();

    // The dialog should have a "Pin" column header
    await expect(dialog.getByText('Pin')).toBeVisible();

    // The "name" row's Pin checkbox should be checked
    const nameRow = dialog.locator('tr', { has: page.locator('td', { hasText: 'name' }) }).first();
    const pinCheckbox = nameRow.getByRole('checkbox', { name: /Pin/ });
    await expect(pinCheckbox).toBeChecked();
  });

  test('pinned header cells remain visible during vertical scroll', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Pin "ID" column
    const idHeader = page.getByRole('columnheader', { name: /Sort by ID/ });
    await idHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // The header should still be visible after scrolling (sticky header row)
    const scrollContainer = page.getByTestId('plain-table-scroll');
    await scrollContainer.evaluate((el) => { el.scrollTop = 200; });

    // The header row should still be visible
    await expect(page.locator('thead')).toBeVisible();

    // The pinned header should still have sticky positioning
    const firstHeader = page.locator('thead th').first();
    const position = await firstHeader.evaluate((el) => el.style.position);
    expect(position).toBe('sticky');
  });

  test('drag reorder stays within pin boundary', async ({ page }) => {
    await gotoHarness(page, 'default');

    // Pin "Name" column (it will move to first position)
    const nameHeader = page.getByRole('columnheader', { name: /Sort by Name/ });
    await nameHeader.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Pin Column' }).click();

    // Now the order should be: Name (pinned), ID, Department, ...
    // Try dragging the pinned "Name" column to the unpinned "Department" position
    // The drag should not be accepted (pin boundary constraint)
    const pinnedHeader = page.locator('thead th').nth(0); // Name (pinned)
    const unpinnedHeader = page.locator('thead th').nth(2); // Department (unpinned)

    // Attempt the drag
    await pinnedHeader.dragTo(unpinnedHeader);

    // Name should still be the first column (drag was blocked at pin boundary)
    const firstHeaderAfterDrag = page.locator('thead th').first();
    await expect(firstHeaderAfterDrag).toContainText('Name');
  });
});
