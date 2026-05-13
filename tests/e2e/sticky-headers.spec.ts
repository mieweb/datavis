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

  test('scroll container has no overflow in viewport mode', async ({ page }) => {
    const overflow = await page.evaluate(() => {
      const scrollDiv = document.querySelector('[data-testid="plain-table-scroll"]');
      return scrollDiv ? getComputedStyle(scrollDiv).overflow : null;
    });
    expect(overflow).toBe('visible');
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
});
