import { determineColumns } from '../adapters';
import type { TableColumn } from './table/types';

type DataVisTypeInfoEntry = {
  type?: string;
  displayText?: string;
  format?: string | Record<string, unknown>;
  internalType?: string;
};

export type DataVisTypeInfoMap = Record<string, DataVisTypeInfoEntry>;

type DataVisTypeInfoOrdMap = {
  keys?: () => string[];
  get?: (key: string) => DataVisTypeInfoEntry | undefined;
};

export type DataVisNitroColumn = string | TableColumn;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeTypeInfo(typeInfo: unknown): DataVisTypeInfoMap {
  if (Array.isArray(typeInfo)) {
    return Object.fromEntries(
      typeInfo.filter(isObject).map((entry) => [entry.field, entry]),
    ) as DataVisTypeInfoMap;
  }

  if (!isObject(typeInfo)) {
    return {};
  }

  const maybeOrdMap = typeInfo as DataVisTypeInfoOrdMap;
  if (
    typeof maybeOrdMap.keys === 'function' &&
    typeof maybeOrdMap.get === 'function'
  ) {
    return Object.fromEntries(
      maybeOrdMap.keys().map((field) => [field, maybeOrdMap.get?.(field) ?? {}]),
    );
  }

  return Object.fromEntries(
    Object.entries(typeInfo).filter(([, value]) => isObject(value)),
  ) as DataVisTypeInfoMap;
}

function normalizeFieldType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  if (type === 'integer') return 'number';
  if (type === 'boolean') return 'string';
  return type;
}

function buildColumnFromField(
  field: string,
  typeInfo: DataVisTypeInfoMap,
): TableColumn {
  const info = typeInfo[field];
  const normalizedType = normalizeFieldType(info?.type);

  return {
    field,
    header: info?.displayText ?? field,
    sortable: true,
    filterable: true,
    resizable: true,
    reorderable: true,
    ...(normalizedType
      ? {
          typeInfo: {
            type: normalizedType,
            ...(info?.format !== undefined ? { format: info.format } : {}),
            ...(info?.internalType !== undefined
              ? { internalType: info.internalType }
              : {}),
          },
        }
      : {}),
  };
}

export function mergeColumnWithTypeInfo(
  column: TableColumn,
  typeInfo: DataVisTypeInfoMap,
): TableColumn {
  const fallbackColumn = buildColumnFromField(column.field, typeInfo);
  return {
    ...fallbackColumn,
    ...column,
    header: column.header ?? fallbackColumn.header,
    typeInfo: column.typeInfo ?? fallbackColumn.typeInfo,
  };
}

export function buildResolvedColumns(
  columns: DataVisNitroColumn[] | undefined,
  fallbackFields: string[],
  typeInfo: DataVisTypeInfoMap,
): TableColumn[] {
  if (columns && columns.length > 0) {
    return columns.map((column) =>
      typeof column === 'string'
        ? buildColumnFromField(column, typeInfo)
        : mergeColumnWithTypeInfo(column, typeInfo),
    );
  }

  return fallbackFields.map((field) => buildColumnFromField(field, typeInfo));
}

export function buildFallbackFieldOrder(
  typeInfo: DataVisTypeInfoMap,
  data: unknown[] | null,
): string[] {
  const rows = Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => isObject(row))
    : null;

  const normalizedEntries = Object.fromEntries(
    Object.entries(typeInfo).map(([field, info]) => [
      field,
      {
        type: normalizeFieldType(info.type) ?? 'string',
        ...(info.displayText !== undefined
          ? { displayText: info.displayText }
          : {}),
      },
    ]),
  );

  return determineColumns(null, normalizedEntries, rows);
}