import type { NormalizedViewData } from '../../adapters/wcdatavis-interop';
import type { TableColumn } from '../table/types';

export type GraphChartType = 'bar' | 'line' | 'area' | 'pie';

export interface GraphSeriesOption {
  key: string;
  label: string;
}

export interface GraphAxisOption {
  key: string;
  label: string;
}

export interface GraphConfig {
  chartType: GraphChartType;
  xField: string;
  yFields: string[];
  stacked: boolean;
  aggregateKey?: string;
}

export interface GraphPoint {
  xValue: unknown;
  values: Record<string, number>;
}

export interface GraphModel {
  mode: 'plain' | 'group' | 'pivot';
  chartType: GraphChartType;
  xField: string;
  yFields: string[];
  series: GraphSeriesOption[];
  points: GraphPoint[];
}

export interface GraphBuildResult {
  model: GraphModel | null;
  axisOptions: GraphAxisOption[];
  seriesOptions: GraphSeriesOption[];
  aggregateOptions: GraphSeriesOption[];
  config: GraphConfig;
}

export interface GraphBuilderParams {
  viewData: NormalizedViewData | null;
  columns: TableColumn[];
  config?: Partial<GraphConfig>;
}