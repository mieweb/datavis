import React, { createContext, useContext, useMemo, useRef } from 'react';
import { ComputedView, Source } from 'datavis-ace';

import {
  buildAggregateFunctions,
  getBuiltinGroupFunctions,
  useView,
  type ViewInstance,
} from '../adapters';
import { DataGrid, type DataGridProps, type GridTableDef } from './DataGrid';
import {
  buildFallbackFieldOrder,
  buildResolvedColumns,
  mergeColumnWithTypeInfo,
  normalizeTypeInfo,
  type DataVisNitroColumn,
} from './nitro-columns';
import { TableRenderer, type TableRendererProps } from './table/TableRenderer';
import type { TableColumn, TableFeatures } from './table/types';

type TranslateFn = (key: string, ...args: unknown[]) => string;

type DataVisNitroSourceType = 'http' | 'local' | 'file';

interface HttpDataVisNitroSourceProps {
  type: 'http';
  url: string;
  children?: React.ReactNode;
}

interface LocalDataVisNitroSourceProps {
  type: 'local';
  varName?: string;
  children?: React.ReactNode;
}

interface FileDataVisNitroSourceProps {
  type: 'file';
  children?: React.ReactNode;
}

export type DataVisNitroSourceProps =
  | HttpDataVisNitroSourceProps
  | LocalDataVisNitroSourceProps
  | FileDataVisNitroSourceProps;

type TrackedViewInstance = ViewInstance & {
  _dvType: DataVisNitroSourceType;
  _dvUrl: string | undefined;
  _dvVarName?: string;
};

export type { DataVisNitroColumn } from './nitro-columns';

export interface DataVisNitroGridProps
  extends
    Omit<DataGridProps, 'view' | 'children' | 'allColumns'>,
    Pick<
      TableRendererProps,
      | 'formatCell'
      | 'onColumnReorder'
      | 'onColumnResize'
      | 'onHeaderContextMenu'
      | 'onRowClick'
      | 'onRowDoubleClick'
      | 'onSelectionChange'
    > {
  columns?: DataVisNitroColumn[];
  allColumns?: TableColumn[];
  features?: TableFeatures;
  style?: React.CSSProperties;
  trans?: TranslateFn;
}

export const DataVisNitroContext = createContext<ViewInstance | null>(null);

function buildControlFields(
  columns: TableColumn[],
): NonNullable<DataGridProps['controlFields']> {
  return columns.map((column) => ({
    field: column.field,
    displayName: column.header,
    type: column.typeInfo?.type,
  }));
}

function buildAggregateFields(
  columns: TableColumn[],
): NonNullable<DataGridProps['aggregateFields']> {
  return columns.map((column) => ({
    field: column.field,
    displayName: column.header,
  }));
}

function mergeTableDef(
  tableDef: GridTableDef | undefined,
  features: TableFeatures | undefined,
): GridTableDef | undefined {
  if (!tableDef && !features) {
    return undefined;
  }

  const { rowMode, ...featureFlags } = features ?? {};
  const mergedFeatures =
    Object.keys(featureFlags).length > 0
      ? ({
          ...(tableDef?.features ?? {}),
          ...featureFlags,
        } as GridTableDef['features'])
      : undefined;

  return {
    ...tableDef,
    ...(rowMode !== undefined ? { rowMode } : {}),
    ...(mergedFeatures ? { features: mergedFeatures } : {}),
  };
}

function DataVisNitroSource(props: DataVisNitroSourceProps) {
  const { type, children } = props;
  const url = props.type === 'http' ? props.url : undefined;
  const varName = props.type === 'local' ? props.varName : undefined;
  const viewRef = useRef<TrackedViewInstance | null>(null);

  if (
    viewRef.current === null ||
    viewRef.current._dvType !== type ||
    viewRef.current._dvUrl !== url ||
    viewRef.current._dvVarName !== varName
  ) {
    const source =
      props.type === 'http'
        ? new Source({ type, url: props.url })
        : new Source(
            props.type === 'local' && props.varName
              ? { type, varName: props.varName }
              : { type },
          );

    viewRef.current = Object.assign(
      new ComputedView(source) as unknown as ViewInstance,
      { _dvType: type, _dvUrl: url, _dvVarName: varName },
    );
  }

  return (
    <DataVisNitroContext.Provider value={viewRef.current}>
      {children}
    </DataVisNitroContext.Provider>
  );
}

function DataVisNitroGridInner({
  computedView,
  columns,
  allColumns,
  features,
  controlFields,
  aggregateFields,
  aggregateFunctions,
  groupFunctionDefs,
  tableDef,
  formatCell,
  onColumnReorder,
  onColumnResize,
  onHeaderContextMenu,
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  style,
  trans,
  ...dataGridProps
}: DataVisNitroGridProps & { computedView: ViewInstance }) {
  const viewState = useView(computedView, false);

  const normalizedTypeInfo = useMemo(
    () => normalizeTypeInfo(viewState.typeInfo ?? computedView.typeInfo ?? null),
    [computedView, viewState.typeInfo],
  );

  const fallbackFields = useMemo(
    () =>
      buildFallbackFieldOrder(normalizedTypeInfo, viewState.data?.data ?? null),
    [normalizedTypeInfo, viewState.data?.data],
  );

  const resolvedAllColumns = useMemo(() => {
    if (allColumns && allColumns.length > 0) {
      return allColumns.map((column) =>
        mergeColumnWithTypeInfo(column, normalizedTypeInfo),
      );
    }

    return buildResolvedColumns(columns, fallbackFields, normalizedTypeInfo);
  }, [allColumns, columns, fallbackFields, normalizedTypeInfo]);

  const resolvedColumns = useMemo(() => {
    if (columns && columns.length > 0) {
      return buildResolvedColumns(
        columns,
        fallbackFields,
        normalizedTypeInfo,
      ).filter((column) => column.visible !== false);
    }

    return resolvedAllColumns.filter((column) => column.visible !== false);
  }, [columns, fallbackFields, normalizedTypeInfo, resolvedAllColumns]);

  const effectiveAggregateFunctions = useMemo(
    () => aggregateFunctions ?? buildAggregateFunctions(),
    [aggregateFunctions],
  );

  const effectiveGroupFunctionDefs = useMemo(
    () =>
      groupFunctionDefs ??
      getBuiltinGroupFunctions(trans as TranslateFn | undefined),
    [groupFunctionDefs, trans],
  );

  const effectiveTableDef = useMemo(
    () => mergeTableDef(tableDef, features),
    [tableDef, features],
  );

  const aggFnLabels = useMemo(
    () =>
      Object.fromEntries(
        effectiveAggregateFunctions.map((aggregateFunction) => [
          aggregateFunction.name,
          aggregateFunction.label,
        ]),
      ),
    [effectiveAggregateFunctions],
  );

  return (
    <div style={style}>
      <DataGrid
        {...dataGridProps}
        view={computedView}
        tableDef={effectiveTableDef}
        allColumns={resolvedAllColumns}
        controlFields={controlFields ?? buildControlFields(resolvedAllColumns)}
        aggregateFields={
          aggregateFields ?? buildAggregateFields(resolvedAllColumns)
        }
        aggregateFunctions={effectiveAggregateFunctions}
        groupFunctionDefs={effectiveGroupFunctionDefs}
      >
        <TableRenderer
          viewData={viewState.data}
          columns={resolvedColumns}
          features={
            (effectiveTableDef?.features as TableFeatures | undefined) ??
            features
          }
          totalRows={viewState.totalRowCount ?? viewState.rowCount}
          loading={viewState.loading || !viewState.ready}
          formatCell={formatCell}
          aggFnLabels={aggFnLabels}
          onColumnReorder={onColumnReorder}
          onColumnResize={onColumnResize}
          onHeaderContextMenu={onHeaderContextMenu}
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          onSelectionChange={onSelectionChange}
        />
      </DataGrid>
    </div>
  );
}

function DataVisNitroGrid(props: DataVisNitroGridProps) {
  const computedView = useContext(DataVisNitroContext);

  if (computedView === null) {
    return null;
  }

  return <DataVisNitroGridInner {...props} computedView={computedView} />;
}

DataVisNitroSource.displayName = 'DataVisNitroSource';
DataVisNitroGrid.displayName = 'DataVisNitroGrid';

export { DataVisNitroGrid, DataVisNitroSource };