/**
 * Aggregate entry helpers shared between the DataGrid controller and the
 * aggregate control. Kept in a dependency-light module so the commit rules can
 * be unit-tested without pulling in the full grid component.
 */

import type { AggregateEntry } from './AggregateSection';

/**
 * An aggregate entry is ready to commit once every required field argument is
 * filled. Functions like `count` take no fields (empty `fields` array) and are
 * complete immediately; `sum`/`avg`/etc. stay incomplete until the user picks a
 * field, so we never push an aggregate with an unknown field to the view.
 */
export function isAggregateEntryComplete(entry: AggregateEntry): boolean {
  return entry.fields.every((field) => field !== '');
}

/** Whether an entry should be reflected in the view's committed aggregate. */
export function isAggregateEntryCommitted(entry: AggregateEntry): boolean {
  return entry.visible && isAggregateEntryComplete(entry);
}
