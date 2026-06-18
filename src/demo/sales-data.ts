/**
 * Sales demo dataset — a realistic order-line table used by the a3t
 * perspective example page.
 *
 * The shape is intentionally aggregation-friendly so the seeded perspectives
 * can demonstrate distinct grid configurations:
 *   - overall revenue by month
 *   - product revenue tracked across years
 *   - salesperson revenue by month
 *
 * Data is generated from a seeded PRNG so every reload (and every reviewer)
 * sees identical numbers.
 */

import type { TableColumn } from '../components/table/types';
import type { ColumnFilterConfig } from '../components/filters/types';

// ───────────────────────────────────────────────────────────
// Reference values
// ───────────────────────────────────────────────────────────

const SALESPEOPLE = [
  'Avery Quinn',
  'Bianca Flores',
  'Diego Park',
  'Elena Rossi',
  'Marcus Webb',
  'Priya Nair',
];

const PRODUCTS: { name: string; category: string; basePrice: number }[] = [
  { name: 'Nitro Analyzer', category: 'Hardware', basePrice: 1800 },
  { name: 'Pulse Sensor', category: 'Hardware', basePrice: 420 },
  { name: 'Vantage Suite', category: 'Software', basePrice: 960 },
  { name: 'Insight Cloud', category: 'Software', basePrice: 1450 },
  { name: 'Care Plan', category: 'Services', basePrice: 300 },
  { name: 'Onsite Training', category: 'Services', basePrice: 750 },
];

const REGIONS = ['North', 'South', 'East', 'West'];

const START_YEAR = 2022;
const END_YEAR = 2024; // inclusive

// ───────────────────────────────────────────────────────────
// Seeded PRNG
// ───────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ───────────────────────────────────────────────────────────
// Generator
// ───────────────────────────────────────────────────────────

export interface SalesRow {
  orderId: number;
  saleDate: string;
  salesperson: string;
  product: string;
  category: string;
  region: string;
  units: number;
  unitPrice: number;
  revenue: number;
}

/**
 * Generate `count` sales order lines spread evenly across the configured year
 * range. Revenue trends upward year over year so the time-series perspectives
 * tell a story.
 */
export function generateSalesData(count = 720): Record<string, unknown>[] {
  const rand = seededRandom(20240517);
  const rows: Record<string, unknown>[] = [];
  const yearSpan = END_YEAR - START_YEAR + 1;

  for (let i = 0; i < count; i += 1) {
    const year = START_YEAR + Math.floor(rand() * yearSpan);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const saleDate = `${year}-${pad(month)}-${pad(day)}`;

    const product = pick(rand, PRODUCTS);
    const salesperson = pick(rand, SALESPEOPLE);
    const region = pick(rand, REGIONS);

    // Year-over-year growth factor plus seasonal lift in Q4.
    const growth = 1 + (year - START_YEAR) * 0.18;
    const seasonal = month >= 10 ? 1.25 : 1;
    const units = 1 + Math.floor(rand() * 12 * growth * seasonal);
    const unitPrice = Number((product.basePrice * (0.9 + rand() * 0.2)).toFixed(2));
    const revenue = Number((units * unitPrice).toFixed(2));

    rows.push({
      orderId: 100000 + i,
      saleDate,
      salesperson,
      product: product.name,
      category: product.category,
      region,
      units,
      unitPrice,
      revenue,
    });
  }

  return rows;
}

// ───────────────────────────────────────────────────────────
// Column + filter definitions
// ───────────────────────────────────────────────────────────

export const SALES_COLUMNS: TableColumn[] = [
  { field: 'orderId', header: 'Order #', width: 90, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'saleDate', header: 'Sale Date', width: 120, sortable: true, resizable: true, typeInfo: { type: 'date' } },
  { field: 'salesperson', header: 'Salesperson', width: 150, sortable: true, resizable: true },
  { field: 'product', header: 'Product', width: 150, sortable: true, resizable: true },
  { field: 'category', header: 'Category', width: 120, sortable: true, resizable: true },
  { field: 'region', header: 'Region', width: 100, sortable: true, resizable: true },
  { field: 'units', header: 'Units', width: 90, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'number' } },
  { field: 'unitPrice', header: 'Unit Price', width: 110, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
  { field: 'revenue', header: 'Revenue', width: 130, sortable: true, resizable: true, align: 'right', typeInfo: { type: 'currency' } },
];

export const SALES_FILTERS: ColumnFilterConfig[] = [
  { field: 'saleDate', displayName: 'Sale Date', filterType: 'date', visible: true },
  { field: 'salesperson', displayName: 'Salesperson', filterType: 'string', widget: 'dropdown', options: SALESPEOPLE, visible: true },
  { field: 'product', displayName: 'Product', filterType: 'string', widget: 'dropdown', options: PRODUCTS.map((p) => p.name), visible: true },
  { field: 'category', displayName: 'Category', filterType: 'string', widget: 'dropdown', options: ['Hardware', 'Software', 'Services'], visible: true },
  { field: 'region', displayName: 'Region', filterType: 'string', widget: 'dropdown', options: REGIONS, visible: true },
  { field: 'units', displayName: 'Units', filterType: 'number', visible: true },
  { field: 'revenue', displayName: 'Revenue', filterType: 'number', visible: true },
];

/** Fields offered in the group/pivot control panel. */
export const SALES_CONTROL_FIELDS = SALES_COLUMNS.map((c) => ({
  field: c.field,
  displayName: c.header,
  type: c.typeInfo?.type,
}));

/** Fields offered for aggregation. */
export const SALES_AGGREGATE_FIELDS = [
  { field: 'units', displayName: 'Units' },
  { field: 'unitPrice', displayName: 'Unit Price' },
  { field: 'revenue', displayName: 'Revenue' },
];
