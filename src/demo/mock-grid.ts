import { ComputedView, Source } from '../../wcdatavis-lib/index.js';

import type { ViewInstance, SourceInstance } from '../adapters/use-data';
import type { AggregateFunction } from '../components/controls/AggregateSection';
import { buildAggregateFunctions, buildLocalSourceTypeInfo, normalizeLocalSourceRows } from '../adapters/wcdatavis-interop';
import i18n from '../i18n/config';

export type MockView = ViewInstance;

let localSourceCounter = 0;

function installLocalDataset(data: Record<string, unknown>[], typeInfo: Record<string, unknown>) {
  localSourceCounter += 1;
  const varName = `__wcdv_local_source_${localSourceCounter}`;
  (window as unknown as Record<string, unknown>)[varName] = { data, typeInfo };
  return varName;
}

export function createMockSource(data: Record<string, unknown>[], columns: Array<{ field: string; header?: string; typeInfo?: { type?: string; format?: string | Record<string, unknown>; internalType?: string } }> = []): SourceInstance {
  const typeInfo = buildLocalSourceTypeInfo(data, columns);
  const normalizedRows = normalizeLocalSourceRows(data, typeInfo);
  const varName = installLocalDataset(normalizedRows, typeInfo);
  return new Source({ type: 'local', varName }, [], undefined, { name: 'Demo Source' }) as unknown as SourceInstance;
}

export function createMockView(data: Record<string, unknown>[], columns: Array<{ field: string; header?: string; typeInfo?: { type?: string; format?: string | Record<string, unknown>; internalType?: string } }> = []): MockView {
  const source = createMockSource(data, columns);
  return new ComputedView(source, { name: 'Demo View' }) as unknown as MockView;
}

/** i18next translation function for use outside React components. */
export const demoTrans = i18n.t.bind(i18n);

export const DEMO_AGG_FUNCTIONS: AggregateFunction[] = buildAggregateFunctions();
