/**
 * Automated accessibility tests using axe-core.
 *
 * Scans key DataGrid views for WCAG 2.1 AA violations.
 * Note: color-contrast is excluded — it depends on theming (Phase 4/5).
 */

import { test, expect } from '@playwright/test';
import { gotoHarness, checkA11y, runActionWithArg } from './helpers';

/** Rules deferred to later phases (theme / visual design) */
const DEFERRED_RULES = ['color-contrast'];

function formatViolations(violations: Array<{ id: string; impact?: string; help: string; nodes: Array<{ html: string }> }>) {
  return violations.map((v) => `[${v.impact}] ${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`).join('\n\n');
}

test.describe('Accessibility — axe WCAG 2.1 AA', () => {
  test('plain table view has no a11y violations', async ({ page }) => {
    await gotoHarness(page, 'default');
    const violations = await checkA11y(page, DEFERRED_RULES);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test('grouped table view has no a11y violations', async ({ page }) => {
    await gotoHarness(page, 'default');
    await runActionWithArg(page, ['department'], (fields: string[]) => {
      window.__wcdv!.actions.setGroup(fields);
    });
    const violations = await checkA11y(page, DEFERRED_RULES);
    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test('filtered view has no a11y violations', async ({ page }) => {
    await gotoHarness(page, 'default');
    await runActionWithArg(
      page,
      { department: { $eq: 'Engineering' } },
      (spec: Record<string, unknown>) => {
        window.__wcdv!.actions.setFilter(spec);
      },
    );
    const violations = await checkA11y(page, DEFERRED_RULES);
    expect(violations, formatViolations(violations)).toEqual([]);
  });
});
