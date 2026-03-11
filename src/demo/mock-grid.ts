import { ComputedView } from 'wcdatavis/src/computed_view.js';
import { Source } from 'wcdatavis/src/source.js';

import type { ViewInstance, SourceInstance } from '../adapters/use-data';
import type { AggregateFunction } from '../components/controls/AggregateSection';
import { buildAggregateFunctions, buildLocalSourceTypeInfo, normalizeLocalSourceRows } from '../adapters/wcdatavis-interop';
import enUsTsv from '../i18n/en-US.tsv?raw';

export type MockView = ViewInstance;

let localSourceCounter = 0;

function installLocalDataset(data: Record<string, unknown>[], typeInfo: Record<string, unknown>) {
  localSourceCounter += 1;
  const varName = `__wcdv_local_source_${localSourceCounter}`;
  (window as Window & Record<string, unknown>)[varName] = { data, typeInfo };
  return varName;
}

export function createMockSource(data: Record<string, unknown>[], columns: Array<{ field: string; header?: string; typeInfo?: { type?: string; format?: string; internalType?: string } }> = []): SourceInstance {
  const typeInfo = buildLocalSourceTypeInfo(data, columns);
  const normalizedRows = normalizeLocalSourceRows(data, typeInfo);
  const varName = installLocalDataset(normalizedRows, typeInfo);
  return new Source({ type: 'local', varName }, [], undefined, { name: 'Demo Source' }) as unknown as SourceInstance;
}

export function createMockView(data: Record<string, unknown>[], columns: Array<{ field: string; header?: string; typeInfo?: { type?: string; format?: string; internalType?: string } }> = []): MockView {
  const source = createMockSource(data, columns);
  return new ComputedView(source, { name: 'Demo View' }) as unknown as MockView;
}

export function parseTsv(raw: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('//') || line.startsWith('Translation Label')) continue;
    const [key, value] = line.split('\t');
    if (key && /^[A-Z0-9_.-]+$/.test(key.trim())) {
      labels[key.trim()] = value?.trim() ?? key.trim();
    }
  }
  return labels;
}

const LABELS = parseTsv(enUsTsv);

export const demoTrans = (key: string, ...args: unknown[]): string => {
  const raw = LABELS[key];
  if (!raw) return '';
  let text = raw;
  for (const arg of args) {
    text = text.replace('%s', String(arg ?? ''));
  }
  return text;
};

export const DEMO_AGG_FUNCTIONS: AggregateFunction[] = buildAggregateFunctions();