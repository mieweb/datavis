import type { ColumnFilterConfig } from '../components/filters/types';
import type { TableColumn } from '../components/table/types';

export interface LegacyMatrixRow extends Record<string, unknown> {
  rowId: number;
  country: string;
  fruit: string;
  category: string;
  string1: string;
  notes: string;
  active: boolean;
  int1: number;
  int2: string;
  int3: string;
  int4: number;
  int5: string;
  int6: string;
  int7: number;
  int8: string;
  int9: string;
  float1: number;
  float2: string;
  float3: string;
  float4: number;
  float5: string;
  float6: string;
  float7: number;
  float8: string;
  float9: string;
  currency1: number;
  currency2: number;
  currency3: number;
  currency4: number;
  date1: string;
  date2: string;
  date3: string;
  datetime1: string;
  datetime2: string;
  datetime3: string;
  time1: string;
  time2: string;
  time3: string;
  duration1: string;
  duration2: string;
  duration3: string;
}

const baseRows = [
  { rowId: 1, country: 'Canada', fruit: 'Apple', category: 'Fruit', string1: 'alpha', notes: 'north', active: true, value: 10, floatValue: 10.5, date: '2026-03-11', datetime: '2026-03-11T09:00', time: '09:00:00', duration: '01:00:00' },
  { rowId: 2, country: 'Canada', fruit: 'Banana', category: 'Fruit', string1: 'bravo', notes: '', active: false, value: 20, floatValue: 20.25, date: '2026-03-10', datetime: '2026-03-10T12:15', time: '12:15:00', duration: '02:00:00' },
  { rowId: 3, country: 'Japan', fruit: 'Apple', category: 'Fruit', string1: 'charlie', notes: 'tokyo', active: true, value: 30, floatValue: 30.75, date: '2026-03-03', datetime: '2026-03-03T08:45', time: '08:45:00', duration: '03:00:00' },
  { rowId: 4, country: 'Japan', fruit: 'Carrot', category: 'Vegetables', string1: 'delta', notes: '', active: false, value: 40, floatValue: 40.5, date: '2026-02-15', datetime: '2026-02-15T16:30', time: '16:30:00', duration: '04:00:00' },
  { rowId: 5, country: 'Mexico', fruit: 'Banana', category: 'Fruit', string1: 'echo', notes: 'south', active: true, value: 50, floatValue: 50.125, date: '2025-12-31', datetime: '2025-12-31T23:30', time: '23:30:00', duration: '05:00:00' },
  { rowId: 6, country: 'Mexico', fruit: 'Carrot', category: 'Vegetables', string1: 'foxtrot', notes: '', active: false, value: 60, floatValue: 60.875, date: '2025-03-11', datetime: '2025-03-11T07:05', time: '07:05:00', duration: '06:00:00' },
  { rowId: 7, country: 'United States', fruit: 'Apple', category: 'Fruit', string1: 'golf', notes: 'west', active: true, value: 70, floatValue: 70.5, date: '2025-03-04', datetime: '2025-03-04T10:10', time: '10:10:00', duration: '07:00:00' },
  { rowId: 8, country: 'United States', fruit: 'Banana', category: 'Fruit', string1: 'hotel', notes: '', active: false, value: 80, floatValue: 80.25, date: '2024-03-11', datetime: '2024-03-11T05:20', time: '05:20:00', duration: '08:00:00' },
] as const;

export const LEGACY_MATRIX_ROWS: LegacyMatrixRow[] = baseRows.map((row) => ({
  rowId: row.rowId,
  country: row.country,
  fruit: row.fruit,
  category: row.category,
  string1: row.string1,
  notes: row.notes,
  active: row.active,
  int1: row.value,
  int2: String(row.value),
  int3: row.value.toLocaleString('en-US'),
  int4: row.value,
  int5: String(row.value),
  int6: row.value.toLocaleString('en-US'),
  int7: row.value,
  int8: String(row.value),
  int9: row.value.toLocaleString('en-US'),
  float1: row.floatValue,
  float2: String(row.floatValue),
  float3: row.floatValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  float4: row.floatValue,
  float5: String(row.floatValue),
  float6: row.floatValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  float7: row.floatValue,
  float8: String(row.floatValue),
  float9: row.floatValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
  currency1: row.floatValue,
  currency2: row.floatValue,
  currency3: row.floatValue,
  currency4: row.floatValue,
  date1: row.date,
  date2: row.date,
  date3: row.date,
  datetime1: row.datetime,
  datetime2: row.datetime,
  datetime3: row.datetime,
  time1: row.time,
  time2: row.time,
  time3: row.time,
  duration1: row.duration,
  duration2: row.duration,
  duration3: row.duration,
}));

function makeNumericColumns(prefix: 'int' | 'float', type: 'number' | 'currency') {
  return Array.from({ length: 9 }, (_, index) => ({
    field: `${prefix}${index + 1}`,
    header: `${prefix}${index + 1}`,
    sortable: true,
    resizable: true,
    align: 'right' as const,
    typeInfo: { type },
  }));
}

export const LEGACY_MATRIX_COLUMNS: TableColumn[] = [
  { field: 'rowId', header: 'Row ID', sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'country', header: 'Country', sortable: true, resizable: true },
  { field: 'fruit', header: 'Fruit', sortable: true, resizable: true },
  { field: 'category', header: 'Category', sortable: true, resizable: true },
  { field: 'string1', header: 'String 1', sortable: true, resizable: true },
  { field: 'notes', header: 'Notes', sortable: true, resizable: true },
  { field: 'active', header: 'Active', sortable: true, resizable: true, typeInfo: { type: 'boolean' } },
  ...makeNumericColumns('int', 'number'),
  ...makeNumericColumns('float', 'number'),
  { field: 'currency1', header: 'Currency 1', sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'currency2', header: 'Currency 2', sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'currency3', header: 'Currency 3', sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'currency4', header: 'Currency 4', sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'date1', header: 'Date 1', sortable: true, resizable: true, typeInfo: { type: 'date' } },
  { field: 'date2', header: 'Date 2', sortable: true, resizable: true, typeInfo: { type: 'date' } },
  { field: 'date3', header: 'Date 3', sortable: true, resizable: true, typeInfo: { type: 'date' } },
  { field: 'datetime1', header: 'DateTime 1', sortable: true, resizable: true, typeInfo: { type: 'datetime' } },
  { field: 'datetime2', header: 'DateTime 2', sortable: true, resizable: true, typeInfo: { type: 'datetime' } },
  { field: 'datetime3', header: 'DateTime 3', sortable: true, resizable: true, typeInfo: { type: 'datetime' } },
  { field: 'time1', header: 'Time 1', sortable: true, resizable: true },
  { field: 'time2', header: 'Time 2', sortable: true, resizable: true },
  { field: 'time3', header: 'Time 3', sortable: true, resizable: true },
  { field: 'duration1', header: 'Duration 1', sortable: true, resizable: true },
  { field: 'duration2', header: 'Duration 2', sortable: true, resizable: true },
  { field: 'duration3', header: 'Duration 3', sortable: true, resizable: true },
];

export const LEGACY_MATRIX_FILTERS: ColumnFilterConfig[] = [
  { field: 'country', displayName: 'Country', filterType: 'string', widget: 'dropdown', options: [...new Set(LEGACY_MATRIX_ROWS.map((row) => row.country))], visible: true },
  { field: 'fruit', displayName: 'Fruit', filterType: 'string', widget: 'dropdown', options: [...new Set(LEGACY_MATRIX_ROWS.map((row) => row.fruit))], visible: true },
  { field: 'string1', displayName: 'String 1', filterType: 'string', widget: 'textbox', visible: true },
  { field: 'date1', displayName: 'Date 1', filterType: 'date', visible: true },
  { field: 'active', displayName: 'Active', filterType: 'boolean', visible: true },
  ...Array.from({ length: 9 }, (_, index) => ({
    field: `int${index + 1}`,
    displayName: `int${index + 1}`,
    filterType: 'number' as const,
    visible: false,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    field: `float${index + 1}`,
    displayName: `float${index + 1}`,
    filterType: 'number' as const,
    visible: false,
  })),
];

export const LEGACY_GROUP_FUNCTIONS = [
  'year',
  'quarter',
  'month',
  'week_iso',
  'day_of_week',
  'year_and_quarter',
  'year_and_month',
  'year_and_week_iso',
  'day',
  'day_and_time_1hr',
  'day_and_time_15min',
  'time_1hr',
  'time_15min',
] as const;

export const LEGACY_AGG_FUNCTIONS = ['count', 'counta', 'countu', 'list', 'sum', 'avg', 'min', 'max'] as const;