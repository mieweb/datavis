import type { NormalizedViewData } from '../../adapters/wcdatavis-interop';
import type { TableColumn } from '../table/types';
import type {
  GraphAxisOption,
  GraphBuildResult,
  GraphBuilderParams,
  GraphChartType,
  GraphConfig,
  GraphPoint,
  GraphSeriesOption,
  GraphModel,
} from './types';

function isNumericColumn(column: TableColumn): boolean {
  return column.typeInfo?.type === 'number' || column.typeInfo?.type === 'currency';
}

function toLabel(value: unknown): string {
  if (value == null || value === '') return 'Empty';
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dedupeSeries(series: GraphSeriesOption[]): GraphSeriesOption[] {
  const seen = new Set<string>();
  return series.filter((entry) => {
    if (seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

function getPreferredAggregateKey(keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;
  const normalized = keys.map((key) => ({ key, lower: key.toLowerCase() }));

  const ranked = [
    (item: { lower: string }) => item.lower.startsWith('sum(') || item.lower === 'sum',
    (item: { lower: string }) => item.lower.startsWith('avg(') || item.lower.startsWith('average(') || item.lower === 'avg' || item.lower === 'average',
    (item: { lower: string }) => item.lower.startsWith('count(') || item.lower === 'count',
  ];

  for (const predicate of ranked) {
    const match = normalized.find(predicate);
    if (match) return match.key;
  }

  return keys[0];
}

function extractPivotAggregateKeys(matrix: Record<string, unknown>[][]): string[] {
  const keys = new Set<string>();

  for (const row of matrix) {
    for (const cell of row) {
      if (!cell || typeof cell !== 'object' || Array.isArray(cell)) continue;
      for (const [key, value] of Object.entries(cell)) {
        if (toNumber(value) != null) {
          keys.add(key);
        }
      }
    }
  }

  return [...keys];
}

function getPlainAxisOptions(columns: TableColumn[]): GraphAxisOption[] {
  return columns.map((column) => ({ key: column.field, label: column.header ?? column.field }));
}

function getPlainSeriesOptions(columns: TableColumn[]): GraphSeriesOption[] {
  return columns
    .filter(isNumericColumn)
    .map((column) => ({ key: column.field, label: column.header ?? column.field }));
}

function buildDefaultConfig(
  axisOptions: GraphAxisOption[],
  seriesOptions: GraphSeriesOption[],
  override?: Partial<GraphConfig>,
): GraphConfig {
  const chartType = override?.chartType ?? 'bar';
  const xField = override?.xField && axisOptions.some((option) => option.key === override.xField)
    ? override.xField
    : axisOptions[0]?.key ?? '';

  const requestedYFields = override?.yFields?.filter((field) => seriesOptions.some((option) => option.key === field)) ?? [];
  const hasExplicitYFieldSelection = override != null
    && Object.prototype.hasOwnProperty.call(override, 'yFields');
  const yFields = hasExplicitYFieldSelection
    ? requestedYFields
    : requestedYFields.length > 0
      ? requestedYFields
      : seriesOptions.slice(0, chartType === 'pie' ? 1 : 2).map((option) => option.key);

  return {
    chartType,
    xField,
    yFields,
    stacked: override?.stacked ?? false,
  };
}

function buildPlainModel(
  viewData: NormalizedViewData,
  columns: TableColumn[],
  config?: Partial<GraphConfig>,
): GraphBuildResult {
  const axisOptions = getPlainAxisOptions(columns);
  const seriesOptions = getPlainSeriesOptions(columns);
  const effectiveConfig = buildDefaultConfig(axisOptions, seriesOptions, config);

  if (!effectiveConfig.xField || effectiveConfig.yFields.length === 0 || !Array.isArray(viewData.data)) {
    return { model: null, axisOptions, seriesOptions, aggregateOptions: [], config: effectiveConfig };
  }

  const points = (viewData.data as Record<string, unknown>[]).map((row) => {
    const values = Object.fromEntries(
      effectiveConfig.yFields.map((field) => [field, toNumber(row[field]) ?? 0]),
    );

    return {
      xValue: row[effectiveConfig.xField],
      values,
    } satisfies GraphPoint;
  });

  return {
    axisOptions,
    seriesOptions,
    aggregateOptions: [],
    config: effectiveConfig,
    model: {
      mode: 'plain',
      chartType: effectiveConfig.chartType,
      xField: effectiveConfig.xField,
      yFields: effectiveConfig.yFields,
      series: seriesOptions.filter((option) => effectiveConfig.yFields.includes(option.key)),
      points,
    } satisfies GraphModel,
  };
}

function buildGroupedModel(
  viewData: NormalizedViewData,
  config?: Partial<GraphConfig>,
): GraphBuildResult {
  const groupFields = viewData.groupFields ?? [];
  const groupMetadata = (viewData.groupMetadata ?? {}) as Record<string, { groupValues?: Record<string, unknown>; aggregates?: Record<string, unknown>; count?: number }>;
  const entries = Object.entries(groupMetadata);
  const aggregateKeys = dedupeSeries(
    entries.flatMap(([, meta]) => Object.keys(meta.aggregates ?? {}).map((key) => ({ key, label: key }))),
  );
  const aggregateOptions = aggregateKeys;
  const seriesOptions = aggregateOptions.length > 0 ? aggregateOptions : [{ key: 'count', label: 'Count' }];
  const defaultAggregateKey = getPreferredAggregateKey(aggregateOptions.map((option) => option.key));
  const selectedAggregateKey = config?.aggregateKey && aggregateOptions.some((option) => option.key === config.aggregateKey)
    ? config.aggregateKey
    : defaultAggregateKey;
  const axisOptions = groupFields.map((field) => ({ key: field, label: field }));
  const hasExplicitYFieldSelection = config != null
    && Object.prototype.hasOwnProperty.call(config, 'yFields');
  const effectiveConfig = buildDefaultConfig(axisOptions, seriesOptions, {
    ...config,
    yFields: hasExplicitYFieldSelection
      ? (config?.yFields ?? [])
      : selectedAggregateKey
        ? [selectedAggregateKey]
        : config?.yFields,
  });

  const nextConfig: GraphConfig = {
    ...effectiveConfig,
    aggregateKey: selectedAggregateKey,
  };

  if (entries.length === 0 || !nextConfig.xField || nextConfig.yFields.length === 0) {
    return { model: null, axisOptions, seriesOptions, aggregateOptions, config: nextConfig };
  }

  const points = entries.map(([, meta]) => {
    const labelSource = meta.groupValues?.[effectiveConfig.xField];
    const values = Object.fromEntries(
      nextConfig.yFields.map((field) => {
        if (field === 'count') return [field, meta.count ?? 0];
        return [field, toNumber(meta.aggregates?.[field]) ?? 0];
      }),
    );

    return {
      xValue: labelSource,
      values,
    } satisfies GraphPoint;
  });

  return {
    axisOptions,
    seriesOptions,
    aggregateOptions,
    config: nextConfig,
    model: {
      mode: 'group',
      chartType: nextConfig.chartType,
      xField: nextConfig.xField,
      yFields: nextConfig.yFields,
      series: seriesOptions.filter((option) => nextConfig.yFields.includes(option.key)),
      points,
    } satisfies GraphModel,
  };
}

function buildPivotModel(
  viewData: NormalizedViewData,
  config?: Partial<GraphConfig>,
): GraphBuildResult {
  const rowFields = viewData.groupFields ?? [];
  const rowVals = Array.isArray(viewData.rowVals) ? (viewData.rowVals as Record<string, unknown>[]) : [];
  const colVals = Array.isArray(viewData.colVals) ? viewData.colVals : [];
  const matrix = Array.isArray(viewData.data) ? (viewData.data as Record<string, unknown>[][]) : [];
  const aggregateKeys = extractPivotAggregateKeys(matrix);
  const aggregateOptions = aggregateKeys.map((key) => ({ key, label: key }));
  const defaultAggregateKey = getPreferredAggregateKey(aggregateKeys);
  const selectedAggregateKey = config?.aggregateKey && aggregateKeys.includes(config.aggregateKey)
    ? config.aggregateKey
    : defaultAggregateKey;
  const axisOptions = rowFields.map((field) => ({ key: field, label: field }));
  const seriesOptions = colVals.map((value, index) => ({ key: String(index), label: toLabel(value) }));
  const effectiveConfig = buildDefaultConfig(axisOptions, seriesOptions, config);
  const nextConfig: GraphConfig = {
    ...effectiveConfig,
    aggregateKey: selectedAggregateKey,
  };

  if (rowVals.length === 0 || colVals.length === 0 || !nextConfig.xField || nextConfig.yFields.length === 0) {
    return { model: null, axisOptions, seriesOptions, aggregateOptions, config: nextConfig };
  }

  const activeIndices = nextConfig.yFields
    .map((field) => Number(field))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < colVals.length);

  const points = rowVals.map((rowValue, rowIndex) => {
    const values = Object.fromEntries(
      activeIndices.map((columnIndex) => {
        const cell = matrix[rowIndex]?.[columnIndex] ?? {};
        const preferredValue = selectedAggregateKey && typeof cell === 'object' && cell != null
          ? (cell as Record<string, unknown>)[selectedAggregateKey]
          : undefined;
        const numeric = toNumber(preferredValue) != null
          ? preferredValue
          : Object.values(cell).find((value) => toNumber(value) != null);
        return [String(columnIndex), toNumber(numeric) ?? 0];
      }),
    );

    return {
      xValue: rowValue[effectiveConfig.xField],
      values,
    } satisfies GraphPoint;
  });

  return {
    axisOptions,
    seriesOptions,
    aggregateOptions,
    config: {
      ...nextConfig,
      yFields: activeIndices.map(String),
    },
    model: {
      mode: 'pivot',
      chartType: nextConfig.chartType,
      xField: nextConfig.xField,
      yFields: activeIndices.map(String),
      series: seriesOptions.filter((option) => activeIndices.map(String).includes(option.key)),
      points,
    } satisfies GraphModel,
  };
}

export function buildGraphModel({ viewData, columns, config }: GraphBuilderParams): GraphBuildResult {
  if (!viewData) {
    return {
      model: null,
      axisOptions: [],
      seriesOptions: [],
      aggregateOptions: [],
      config: {
        chartType: config?.chartType ?? 'bar',
        xField: '',
        yFields: [],
        stacked: config?.stacked ?? false,
        aggregateKey: config?.aggregateKey,
      },
    };
  }

  if (viewData.isPivot) {
    return buildPivotModel(viewData, config);
  }

  if (viewData.isGroup) {
    return buildGroupedModel(viewData, config);
  }

  return buildPlainModel(viewData, columns, config);
}

export function getSupportedChartTypes(mode: NormalizedViewData | null): GraphChartType[] {
  if (mode?.isPivot) return ['bar', 'line', 'area'];
  if (mode?.isGroup) return ['bar', 'line', 'area', 'pie'];
  return ['bar', 'line', 'area', 'pie'];
}