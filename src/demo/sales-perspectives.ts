/**
 * Default sales perspectives — the "out of the box" grid configurations we
 * ship and distribute via a3t. Each perspective is a saved combination of
 * grouping + aggregation (and an optional graph setup) that tells a different
 * story about the same sales dataset:
 *
 *   1. Overall revenue by month   — time series across the whole business
 *   2. Product sales by year       — track each product line year over year
 *   3. Salesperson revenue by month — per-rep performance over time
 *
 * The blob is seeded idempotently through a3t; user edits are layered on top
 * and never clobbered by re-seeding.
 */

import { buildGroupSpec } from '../adapters/group-adapter';
import { toLegacyAggregateSpec } from '../adapters/wcdatavis-interop';
import type { GraphConfig } from '../components/graph';
import type { PerspectiveBlob, StoredPerspective } from '../adapters/a3t-prefs-backend';

/** Build a perspective config from a group spec, a revenue sum, and a graph. */
function salesPerspective(
  id: string,
  name: string,
  groupFields: { field: string; fun?: string }[],
  graph: Partial<GraphConfig>,
): StoredPerspective {
  return {
    id,
    name,
    config: {
      view: {
        group: buildGroupSpec(groupFields),
        aggregate: toLegacyAggregateSpec([{ fn: 'sum', fields: ['revenue'] }]),
      },
      graph,
    },
  };
}

const SALES_BY_MONTH = salesPerspective(
  'sales-by-month',
  'Overall Revenue by Month',
  [{ field: 'saleDate', fun: 'year_and_month' }],
  { chartType: 'line', yFields: ['sum(revenue)'] },
);

const PRODUCT_BY_YEAR = salesPerspective(
  'product-by-year',
  'Product Sales by Year',
  [{ field: 'product' }, { field: 'saleDate', fun: 'year' }],
  { chartType: 'bar', yFields: ['sum(revenue)'] },
);

const SALESPERSON_BY_MONTH = salesPerspective(
  'salesperson-by-month',
  'Salesperson Revenue by Month',
  [{ field: 'salesperson' }, { field: 'saleDate', fun: 'year_and_month' }],
  { chartType: 'line', yFields: ['sum(revenue)'] },
);

/** The seeded perspective blob shipped with the sales demo. */
export const SALES_PERSPECTIVE_BLOB: PerspectiveBlob = {
  current: SALES_BY_MONTH.id,
  perspectives: {
    [SALES_BY_MONTH.id]: SALES_BY_MONTH,
    [PRODUCT_BY_YEAR.id]: PRODUCT_BY_YEAR,
    [SALESPERSON_BY_MONTH.id]: SALESPERSON_BY_MONTH,
  },
};

/** Stable Prefs instance id used to key the seeded blob in a3t. */
export const SALES_PREFS_ID = 'nitro-sales';
