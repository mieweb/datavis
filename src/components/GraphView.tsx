import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mieweb/ui/components/Button';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { NormalizedViewData } from '../adapters/wcdatavis-interop';
import type { TableColumn } from './table/types';
import { formatCellValue } from './table/format-cell';
import { buildGraphModel, getSupportedChartTypes } from './graph/model';
import type { GraphChartType, GraphConfig } from './graph/types';
import { ChevronGlyphIcon, DocumentIcon } from './ui';

const COLORS = ['#1d4ed8', '#0f766e', '#dc2626', '#7c3aed', '#ea580c', '#0891b2'];

export interface GraphViewProps {
  viewData: NormalizedViewData | null;
  columns: TableColumn[];
  config?: Partial<GraphConfig>;
  locale?: string;
  className?: string;
  onConfigChange?: (config: GraphConfig) => void;
}

function findColumn(columns: TableColumn[], field: string): TableColumn | undefined {
  return columns.find((column) => column.field === field);
}

export function GraphView({
  viewData,
  columns,
  config,
  locale,
  className = '',
  onConfigChange,
}: GraphViewProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const graph = useMemo(() => buildGraphModel({ viewData, columns, config }), [viewData, columns, config]);
  const supportedChartTypes = useMemo(() => getSupportedChartTypes(viewData), [viewData]);
  const xAxisColumn = useMemo(() => findColumn(columns, graph.config.xField), [columns, graph.config.xField]);

  const formatXAxisValue = (value: unknown) => formatCellValue(value, xAxisColumn?.typeInfo, locale);

  const handleChartTypeChange = (chartType: GraphChartType) => {
    onConfigChange?.({ ...graph.config, chartType });
  };

  const handleXFieldChange = (xField: string) => {
    onConfigChange?.({ ...graph.config, xField });
  };

  const handleYFieldChange = (value: string[]) => {
    onConfigChange?.({ ...graph.config, yFields: value });
  };

  const toggleYField = (field: string) => {
    const next = graph.config.yFields.includes(field)
      ? graph.config.yFields.filter((entry) => entry !== field)
      : [...graph.config.yFields, field];

    handleYFieldChange(next);
  };

  const handleAggregateKeyChange = (aggregateKey: string) => {
    const shouldPinSeriesToAggregate = graph.seriesOptions.some((option) => option.key === aggregateKey);
    onConfigChange?.({
      ...graph.config,
      aggregateKey,
      yFields: shouldPinSeriesToAggregate ? [aggregateKey] : graph.config.yFields,
    });
  };

  const handleDownloadPng = useCallback(() => {
    const svg = chartContainerRef.current?.querySelector('svg');
    if (!svg) return;

    const { width: rawWidth, height: rawHeight } = svg.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rawWidth));
    const height = Math.max(1, Math.ceil(rawHeight));

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `graph-${new Date().toISOString().slice(0, 10)}.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
    };

    image.src = url;
  }, []);

  const mappedData = graph.model?.points.map((point) => ({
    xValue: point.xValue,
    xLabel: formatXAxisValue(point.xValue),
    ...point.values,
  })) ?? [];

  const renderCartesianChart = () => {
    if (!graph.model) return null;

    const commonProps = {
      data: mappedData,
      margin: { top: 12, right: 16, left: 4, bottom: 16 },
    };

    const seriesNodes = graph.model.series.map((series, index) => {
      const color = COLORS[index % COLORS.length];
      const key = series.key;

      if (graph.model?.chartType === 'line') {
        return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />;
      }

      if (graph.model?.chartType === 'area') {
        return <Area key={key} type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.2} stackId={graph.config.stacked ? 'stack' : undefined} />;
      }

      return <Bar key={key} dataKey={key} fill={color} stackId={graph.config.stacked ? 'stack' : undefined} radius={[4, 4, 0, 0]} />;
    });

    const chartBody = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="xLabel" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip
          labelFormatter={(value: unknown) => formatXAxisValue(value)}
          formatter={(value: unknown, name: string | number | undefined) => {
            const seriesKey = name == null ? '' : String(name);
            const column = findColumn(columns, seriesKey);
            return [formatCellValue(value, column?.typeInfo, locale), column?.header ?? seriesKey];
          }}
        />
        <Legend />
        {seriesNodes}
      </>
    );

    if (graph.model.chartType === 'line') {
      return <LineChart {...commonProps}>{chartBody}</LineChart>;
    }

    if (graph.model.chartType === 'area') {
      return <AreaChart {...commonProps}>{chartBody}</AreaChart>;
    }

    return <BarChart {...commonProps}>{chartBody}</BarChart>;
  };

  const renderPieChart = () => {
    if (!graph.model || graph.model.yFields.length === 0) return null;
    const field = graph.model.yFields[0];
    const pieData = graph.model.points.map((point) => ({
      name: formatXAxisValue(point.xValue),
      value: point.values[field] ?? 0,
    }));

    return (
      <PieChart margin={{ top: 12, right: 16, left: 16, bottom: 12 }}>
        <Tooltip formatter={(value: unknown) => formatCellValue(value, undefined, locale)} />
        <Legend />
        <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={55} paddingAngle={2}>
          {pieData.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  };

  return (
    <section className={`rounded-lg border border-gray-200 bg-white ${className}`} aria-label={t('GRAPH.TITLEBAR.SHOW_HIDE') || 'Graph'}>
      <div
        className="wcdv-title-bar flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200"
        role="group"
        aria-label={t('GRAPH.TITLEBAR.SHOW_HIDE') || 'Graph'}
      >
        <strong className="text-sm font-semibold text-gray-800">{t('GRAPH.TITLEBAR.SHOW_HIDE') || 'Graph'}</strong>
        <span className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownloadPng}
          aria-label={t('GRAPH.TITLEBAR.DOWNLOAD_PNG') || 'Download PNG'}
        >
          <DocumentIcon className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? (t('GRID.TITLEBAR.EXPAND') || 'Expand') : (t('GRID.TITLEBAR.COLLAPSE') || 'Collapse')}
        >
          <ChevronGlyphIcon className="h-4 w-4" direction={collapsed ? 'right' : 'down'} />
        </Button>
      </div>

      {!collapsed && (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="graph-chart-type">
                {t('GRAPH.CONTROLS.CHART_TYPE') || 'Chart Type'}
              </label>
              <select
                id="graph-chart-type"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={graph.config.chartType}
                onChange={(event) => handleChartTypeChange(event.target.value as GraphChartType)}
              >
                {supportedChartTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="graph-x-field">
                {t('GRAPH.CONTROLS.X_AXIS') || 'X Axis'}
              </label>
              <select
                id="graph-x-field"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={graph.config.xField}
                onChange={(event) => handleXFieldChange(event.target.value)}
              >
                {graph.axisOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </div>

            {graph.model?.mode === 'pivot' && graph.aggregateOptions.length > 0 && (
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="graph-aggregate-key">
                  {t('CONTROL.AGGREGATE') || 'Aggregate'}
                </label>
                <select
                  id="graph-aggregate-key"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={graph.config.aggregateKey ?? ''}
                  onChange={(event) => handleAggregateKeyChange(event.target.value)}
                >
                  {graph.aggregateOptions.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex min-w-[220px] flex-1 flex-wrap gap-2">
              <span className="w-full text-xs font-medium text-gray-600">{t('GRAPH.CONTROLS.Y_AXIS') || 'Y Axis'}</span>
              {graph.seriesOptions.map((option) => {
                const active = graph.config.yFields.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'}`}
                    onClick={() => toggleYField(option.key)}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {graph.config.chartType !== 'pie' && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={graph.config.stacked}
                  onChange={(event) => onConfigChange?.({ ...graph.config, stacked: event.target.checked })}
                />
                {t('GRAPH.CONTROLS.STACKED') || 'Stacked'}
              </label>
            )}
          </div>

          <div ref={chartContainerRef} className="h-[360px] px-2 py-3">
            {!graph.model || graph.model.points.length === 0 || graph.model.yFields.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                {t('DATA.NOTHING_TO_GRAPH') || 'Nothing to Graph'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {graph.model.chartType === 'pie' ? renderPieChart() : renderCartesianChart()}
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </section>
  );
}