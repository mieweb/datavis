import { useCallback, useContext, useMemo, useState } from 'react';

import { useView, type ViewInstance } from '../adapters';
import { DataVisNitroContext } from './DataVisNitro';
import { GraphView } from './GraphView';
import {
  buildFallbackFieldOrder,
  buildResolvedColumns,
  normalizeTypeInfo,
  type DataVisNitroColumn,
} from './nitro-columns';
import type { GraphConfig } from './graph';

export interface DataVisNitroGraphProps {
  columns?: DataVisNitroColumn[];
  config?: Partial<GraphConfig>;
  locale?: string;
  className?: string;
  height?: string;
  onConfigChange?: (config: GraphConfig) => void;
}

function DataVisNitroGraphInner({
  computedView,
  columns,
  config: initialConfig,
  locale,
  className,
  height,
  onConfigChange,
}: DataVisNitroGraphProps & { computedView: ViewInstance }) {
  const viewState = useView(computedView, false);
  const [liveConfig, setLiveConfig] = useState<
    Partial<GraphConfig> | undefined
  >(initialConfig);

  const handleConfigChange = useCallback(
    (newConfig: GraphConfig) => {
      setLiveConfig(newConfig);
      onConfigChange?.(newConfig);
    },
    [onConfigChange],
  );

  const normalizedTypeInfo = useMemo(
    () => normalizeTypeInfo(viewState.typeInfo ?? computedView.typeInfo ?? null),
    [computedView, viewState.typeInfo],
  );

  const fallbackFields = useMemo(
    () =>
      buildFallbackFieldOrder(normalizedTypeInfo, viewState.data?.data ?? null),
    [normalizedTypeInfo, viewState.data?.data],
  );

  const resolvedColumns = useMemo(
    () => buildResolvedColumns(columns, fallbackFields, normalizedTypeInfo),
    [columns, fallbackFields, normalizedTypeInfo],
  );

  return (
    <div className="wcdv-graph" style={height ? { height } : undefined}>
      <GraphView
        viewData={viewState.data}
        columns={resolvedColumns}
        config={liveConfig}
        locale={locale}
        className={className}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}

function DataVisNitroGraph(props: DataVisNitroGraphProps) {
  const computedView = useContext(DataVisNitroContext);

  if (computedView === null) {
    return null;
  }

  return <DataVisNitroGraphInner {...props} computedView={computedView} />;
}

DataVisNitroGraph.displayName = 'DataVisNitroGraph';

export { DataVisNitroGraph };