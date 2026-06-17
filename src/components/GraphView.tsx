import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mieweb/ui/components/Button';
import { Checkbox } from '@mieweb/ui/components/Checkbox';
import { Select } from '@mieweb/ui/components/Select';
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

function getSvgRenderSize(svg: SVGSVGElement): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  const attrWidth = Number(svg.getAttribute('width'));
  const attrHeight = Number(svg.getAttribute('height'));
  const width = Number.isFinite(attrWidth) && attrWidth > 0 ? attrWidth : rect.width;
  const height = Number.isFinite(attrHeight) && attrHeight > 0 ? attrHeight : rect.height;
  return {
    width: Math.max(1, Math.ceil(width)),
    height: Math.max(1, Math.ceil(height)),
  };
}

function findLargestSvg(container: HTMLElement): SVGSVGElement | null {
  const svgs = Array.from(container.querySelectorAll('svg')) as SVGSVGElement[];
  if (svgs.length === 0) return null;

  const ranked = svgs
    .map((svg) => {
      const { width, height } = getSvgRenderSize(svg);
      return { svg, area: width * height };
    })
    .sort((a, b) => b.area - a.area);

  return ranked[0]?.svg ?? null;
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
  const seriesLabelByKey = useMemo(
    () => Object.fromEntries((graph.model?.series ?? []).map((series) => [series.key, series.label])),
    [graph.model?.series],
  );
  const tooltipWrapperStyle = {
    zIndex: 50,
  };
  const tooltipContentStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
    opacity: 1,
  };
  const tooltipLabelStyle = {
    color: '#111827',
    fontWeight: 600,
  };

  const formatXAxisValue = (value: unknown) => formatCellValue(value, xAxisColumn?.typeInfo, locale);
  const chartTypeOptions = useMemo(
    () => supportedChartTypes.map((type) => ({ value: type, label: type })),
    [supportedChartTypes],
  );
  const xAxisOptions = useMemo(
    () => graph.axisOptions.map((option) => ({ value: option.key, label: option.label })),
    [graph.axisOptions],
  );

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

  const handleDownloadPng = useCallback(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const svg = findLargestSvg(container);
    if (!svg) return;

    const { width, height } = getSvgRenderSize(svg);

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
      const label = series.label;

      if (graph.model?.chartType === 'line') {
        return <Line key={key} type="monotone" dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} />;
      }

      if (graph.model?.chartType === 'area') {
        return <Area key={key} type="monotone" dataKey={key} name={label} stroke={color} fill={color} fillOpacity={0.2} stackId={graph.config.stacked ? 'stack' : undefined} />;
      }

      return <Bar key={key} dataKey={key} name={label} fill={color} stackId={graph.config.stacked ? 'stack' : undefined} radius={[4, 4, 0, 0]} />;
    });

    const chartBody = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="xLabel" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip
          wrapperStyle={tooltipWrapperStyle}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: unknown) => formatXAxisValue(value)}
          formatter={(value: unknown, name: string | number | undefined) => {
            const seriesKey = name == null ? '' : String(name);
            const column = findColumn(columns, seriesKey);
            return [
              formatCellValue(value, column?.typeInfo, locale),
              column?.header ?? seriesLabelByKey[seriesKey] ?? seriesKey,
            ];
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
        <Tooltip
          wrapperStyle={tooltipWrapperStyle}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: unknown) => formatCellValue(value, undefined, locale)}
        />
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
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {t('GRAPH.CONTROLS.CHART_TYPE') || 'Chart Type'}
              </label>
              <Select
                options={chartTypeOptions}
                value={graph.config.chartType}
                onValueChange={(value) => handleChartTypeChange(value as GraphChartType)}
                label={t('GRAPH.CONTROLS.CHART_TYPE') || 'Chart Type'}
                aria-label={t('GRAPH.CONTROLS.CHART_TYPE') || 'Chart Type'}
                hideLabel
                size="sm"
                className="w-full"
              />
            </div>

            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {t('GRAPH.CONTROLS.X_AXIS') || 'X Axis'}
              </label>
              <Select
                options={xAxisOptions}
                value={graph.config.xField}
                onValueChange={handleXFieldChange}
                label={t('GRAPH.CONTROLS.X_AXIS') || 'X Axis'}
                aria-label={t('GRAPH.CONTROLS.X_AXIS') || 'X Axis'}
                hideLabel
                size="sm"
                className="w-full"
              />
            </div>

            <div className="flex min-w-[220px] flex-1 flex-wrap gap-2" role="group" aria-label={t('GRAPH.CONTROLS.Y_AXIS') || 'Y Axis'}>
              <span className="w-full text-xs font-medium text-gray-600">{t('GRAPH.CONTROLS.Y_AXIS') || 'Y Axis'}</span>
              {graph.seriesOptions.map((option) => {
                const active = graph.config.yFields.includes(option.key);
                return (
                  <div key={option.key} className="py-1">
                    <Checkbox
                      size="sm"
                      label={option.label}
                      checked={active}
                      onChange={(event) => {
                        if (event.target.checked) {
                          if (!active) toggleYField(option.key);
                          return;
                        }

                        if (active) toggleYField(option.key);
                      }}
                      aria-label={`${t('GRAPH.CONTROLS.Y_AXIS') || 'Y Axis'} ${option.label}`}
                    />
                  </div>
                );
              })}
            </div>

            {graph.config.chartType !== 'pie' && (
              <div className="flex items-center text-sm text-gray-700">
                <Checkbox
                  size="sm"
                  checked={graph.config.stacked}
                  onChange={(event) => onConfigChange?.({ ...graph.config, stacked: event.target.checked })}
                  label={t('GRAPH.CONTROLS.STACKED') || 'Stacked'}
                  aria-label={t('GRAPH.CONTROLS.STACKED') || 'Stacked'}
                />
              </div>
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