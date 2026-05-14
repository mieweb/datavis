/**
 * E2E tests for sticky floating column headers.
 *
 * Tests two modes:
 * - Viewport mode (sticky-viewport): page scrolls, headers stick to viewport top
 * - Container mode (sticky-container): grid has fixed height, headers stick to container top
 */

import { test, expect } from '@playwright/test';

/** Navigate to a sticky scenario and wait for table data to render */
async function gotoSticky(page: import('@playwright/test').Page, scenario: 'sticky-viewport' | 'sticky-container') {
  await page.goto(`/?e2e=${scenario}`);
  await page.waitForSelector('thead th', { timeout: 10000 });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
}

test.describe('Sticky Headers — Viewport Mode', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSticky(page, 'sticky-viewport');
  });

  test('page scrolls and headers remain visible at viewport top', async ({ page }) => {
    // Verify the page is scrollable
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(pageHeight).toBeGreaterThan(viewportHeight);

    // Scroll down significantly
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(50);

    // Verify thead is stuck at the top of the viewport
    const theadRect = await page.evaluate(() => {
      const thead = document.querySelector('thead');
      return thead?.getBoundingClientRect();
    });
    expect(theadRect).toBeTruthy();
    expect(theadRect!.top).toBeLessThanOrEqual(1);
  });

  test('scroll container has overflow-x for horizontal scrolling in viewport mode', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (!scrollDiv) return null;
      const style = getComputedStyle(scrollDiv);
      return { x: style.overflowX, y: style.overflowY };
    });
    // overflow-x: auto for horizontal scrolling within grid chrome
    expect(overflow?.x).toBe('auto');
  });

  test('shadow appears when headers are floating', async ({ page }) => {
    // Initially no shadow
    const initialShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(initialShadow).toBe(false);

    // Scroll past the header's natural position
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(50);

    const hasShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(hasShadow).toBe(true);
  });

  test('shadow disappears when scrolled back to top', async ({ page }) => {
    // Scroll down to activate shadow
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(50);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(50);

    const hasShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(hasShadow).toBe(false);
  });

  test('auto-show-more loads rows when scrolling to bottom', async ({ page }) => {
    const initialRowCount = await page.evaluate(() =>
      document.querySelectorAll('tbody tr').length,
    );
    expect(initialRowCount).toBe(100);

    // Scroll to the bottom of the page
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);

    const newRowCount = await page.evaluate(() =>
      document.querySelectorAll('tbody tr').length,
    );
    expect(newRowCount).toBe(200);
  });

  test('header text is readable after scrolling', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(50);

    // Verify header cells contain expected column text
    const headerTexts = await page.evaluate(() => {
      const ths = document.querySelectorAll('thead th');
      return Array.from(ths).map((th) => th.textContent?.trim());
    });
    expect(headerTexts.length).toBeGreaterThan(0);
    expect(headerTexts).toContain('Txn ID');
  });

  test('pinned column stays left while floating headers stay at viewport top', async ({ page }) => {
    // Pin the first column via header context menu
    const firstTh = page.locator('thead th').first();
    await firstTh.click({ button: 'right' });
    await page.locator('text=Pin Column').click();
    await page.waitForTimeout(50);

    // Scroll page down to activate floating headers
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(50);

    // Scroll the table container horizontally
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) scrollDiv.scrollLeft = 400;
    });
    await page.waitForTimeout(50);

    const result = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      const thead = document.querySelector('thead');
      const firstTh = thead?.querySelector('th');
      if (!scrollDiv || !thead || !firstTh) return null;
      const scrollRect = scrollDiv.getBoundingClientRect();
      const thRect = firstTh.getBoundingClientRect();
      return {
        theadTop: thead.getBoundingClientRect().top,
        pinnedAtLeft: Math.abs(thRect.left - scrollRect.left) < 2,
        scrollLeft: scrollDiv.scrollLeft,
      };
    });
    expect(result).toBeTruthy();
    // Headers are floating at viewport top
    expect(result!.theadTop).toBeLessThanOrEqual(1);
    // Pinned column stays at the left edge of the scroll container
    expect(result!.pinnedAtLeft).toBe(true);
    expect(result!.scrollLeft).toBeGreaterThan(0);
  });
});

test.describe('Sticky Headers — Container Mode', () => {
  test.beforeEach(async ({ page }) => {
    await gotoSticky(page, 'sticky-container');
  });

  test('page does not scroll in container mode', async ({ page }) => {
    const isPageScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(isPageScrollable).toBe(false);
  });

  test('scroll container has overflow-auto in container mode', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      return scrollDiv ? getComputedStyle(scrollDiv).overflow : null;
    });
    expect(overflow).toBe('auto');
  });

  test('scroll container is scrollable', async ({ page }) => {
    const scrollInfo = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (!scrollDiv) return null;
      return {
        clientHeight: scrollDiv.clientHeight,
        scrollHeight: scrollDiv.scrollHeight,
      };
    });
    expect(scrollInfo).toBeTruthy();
    expect(scrollInfo!.scrollHeight).toBeGreaterThan(scrollInfo!.clientHeight);
  });

  test('headers stick to container top when scrolled', async ({ page }) => {
    // Scroll the inner container
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) scrollDiv.scrollTop = 300;
    });
    await page.waitForTimeout(50);

    // Verify thead is at the top of the scroll container
    const positions = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      const thead = document.querySelector('thead');
      if (!scrollDiv || !thead) return null;
      return {
        scrollDivTop: scrollDiv.getBoundingClientRect().top,
        theadTop: thead.getBoundingClientRect().top,
      };
    });
    expect(positions).toBeTruthy();
    expect(Math.abs(positions!.scrollDivTop - positions!.theadTop)).toBeLessThan(2);
  });

  test('shadow appears when scrolled within container', async ({ page }) => {
    // Initially no shadow
    const initialShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(initialShadow).toBe(false);

    // Scroll the container
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) {
        scrollDiv.scrollTop = 100;
        scrollDiv.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(50);

    const hasShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(hasShadow).toBe(true);
  });

  test('shadow disappears when scrolled back to top of container', async ({ page }) => {
    // Scroll down
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) {
        scrollDiv.scrollTop = 200;
        scrollDiv.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(50);

    // Scroll back to top
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) {
        scrollDiv.scrollTop = 0;
        scrollDiv.dispatchEvent(new Event('scroll'));
      }
    });
    await page.waitForTimeout(50);

    const hasShadow = await page.evaluate(() =>
      document.querySelector('thead')?.classList.contains('wcdv-thead-shadow'),
    );
    expect(hasShadow).toBe(false);
  });

  test('header text is readable after scrolling in container', async ({ page }) => {
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) scrollDiv.scrollTop = 500;
    });
    await page.waitForTimeout(50);

    const headerTexts = await page.evaluate(() => {
      const ths = document.querySelectorAll('thead th');
      return Array.from(ths).map((th) => th.textContent?.trim());
    });
    expect(headerTexts.length).toBeGreaterThan(0);
    expect(headerTexts).toContain('Txn ID');
  });

  test('grid respects the 400px height constraint', async ({ page }) => {
    const gridHeight = await page.evaluate(() => {
      const grid = document.querySelector('.wcdv-grid');
      return grid ? getComputedStyle(grid).height : null;
    });
    expect(gridHeight).toBe('400px');
  });

  test('pinned column stays left while headers stick to container top', async ({ page }) => {
    // Pin the first column via header context menu
    const firstTh = page.locator('thead th').first();
    await firstTh.click({ button: 'right' });
    await page.locator('text=Pin Column').click();
    await page.waitForTimeout(50);

    // Scroll the container down to activate sticky headers
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) scrollDiv.scrollTop = 300;
    });
    await page.waitForTimeout(50);

    // Scroll the container horizontally
    await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      if (scrollDiv) scrollDiv.scrollLeft = 400;
    });
    await page.waitForTimeout(50);

    const result = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      const thead = document.querySelector('thead');
      const firstTh = thead?.querySelector('th');
      if (!scrollDiv || !thead || !firstTh) return null;
      const scrollRect = scrollDiv.getBoundingClientRect();
      const theadRect = thead.getBoundingClientRect();
      const thRect = firstTh.getBoundingClientRect();
      return {
        theadStuck: Math.abs(theadRect.top - scrollRect.top) < 2,
        pinnedAtLeft: Math.abs(thRect.left - scrollRect.left) < 2,
        scrollLeft: scrollDiv.scrollLeft,
        scrollTop: scrollDiv.scrollTop,
      };
    });
    expect(result).toBeTruthy();
    // Headers stuck to container top
    expect(result!.theadStuck).toBe(true);
    // Pinned column stays at left edge
    expect(result!.pinnedAtLeft).toBe(true);
    expect(result!.scrollLeft).toBeGreaterThan(0);
    expect(result!.scrollTop).toBeGreaterThan(0);
  });
});
