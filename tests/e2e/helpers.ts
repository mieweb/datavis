import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type HarnessState = {
  scenario: string;
  mode: 'plain' | 'group' | 'pivot';
  rowCount: number;
  selectedRows: number[];
  visibleRows: Array<Record<string, unknown>>;
  filterSpec: Record<string, unknown> | null;
  groupFields: string[];
  pivotFields: string[];
  groupMetadata: Record<string, unknown>;
  rowVals: Array<Record<string, unknown>>;
  colVals: unknown[];
  pivotMatrix: Array<Array<Record<string, unknown>>>;
  pivotGrandTotal: Record<string, unknown>;
  totalAggregates: Record<string, unknown>;
  sort: { vertical?: { field: string; dir: string } } | null;
  busy: boolean;
  revision: number;
};

declare global {
  interface Window {
    __wcdv?: {
      getState: () => HarnessState;
      actions: {
        setFilter: (spec: Record<string, unknown> | null) => void;
        clearFilter: () => void;
        setSort: (field: string, dir: 'ASC' | 'DESC') => void;
        clearSort: () => void;
        setGroup: (fields: string[]) => void;
        clearGroup: () => void;
        setAggregate: (spec: Array<{ fn: string; fields: string[] }> | null) => void;
        refresh: () => void;
      };
    };
  }
}

export async function gotoHarness(page: Page, scenario = 'default') {
  await page.goto(`/?e2e=${scenario}`);
  await page.waitForFunction(() => Boolean(window.__wcdv));
  await page.waitForFunction(() => {
    if (!window.__wcdv) return false;
    const state = window.__wcdv.getState();
    return !state.busy && state.revision > 0;
  });
}

export async function getState(page: Page): Promise<HarnessState> {
  return page.evaluate(() => window.__wcdv!.getState());
}

export async function waitForIdle(page: Page, previousRevision?: number) {
  await page.waitForFunction(
    ({ revision }) => {
      if (!window.__wcdv) return false;
      const state = window.__wcdv.getState();
      if (state.busy) return false;
      if (revision == null) return true;
      return state.revision > revision;
    },
    { revision: previousRevision },
  );
}

export async function runAction(page: Page, action: () => void) {
  const { revision } = await getState(page);
  await page.evaluate(action);
  await waitForIdle(page, revision);
}

export async function runActionWithArg<T>(page: Page, arg: T, action: (value: T) => void) {
  const { revision } = await getState(page);
  await (page as unknown as { evaluate: (fn: unknown, value: unknown) => Promise<void> }).evaluate(action, arg);
  await waitForIdle(page, revision);
}

export async function expectRowCount(page: Page, expected: number) {
  await expect.poll(async () => (await getState(page)).rowCount).toBe(expected);
}

/**
 * Run axe-core accessibility scan on the page targeting WCAG 2.1 AA.
 * Returns the violations array so tests can assert on it.
 */
export async function checkA11y(page: Page, disableRules: string[] = []) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(disableRules)
    .analyze();
  return results.violations;
}