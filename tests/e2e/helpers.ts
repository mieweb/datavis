import { expect, type Page } from '@playwright/test';

export type HarnessState = {
  scenario: string;
  mode: 'plain' | 'group' | 'pivot';
  rowCount: number;
  selectedRows: number[];
  visibleRows: Array<Record<string, unknown>>;
  filterSpec: Record<string, unknown> | null;
  groupFields: string[];
  groupMetadata: Record<string, unknown>;
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
  await waitForIdle(page);
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

export async function expectRowCount(page: Page, expected: number) {
  await expect.poll(async () => (await getState(page)).rowCount).toBe(expected);
}