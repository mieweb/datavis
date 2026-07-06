/**
 * Stable row identity — assigns each row object a persistent numeric id so
 * selection can follow the row's content across filtering, sorting, and
 * limiting (row indexes shift; object identity doesn't).
 */

// Negative ids so WeakMap-assigned ids can never collide with _rowId numbers
let nextId = -1;
const rowIds = new WeakMap<object, number>();

/**
 * Return a stable id for the given row so selection can follow the row's
 * content across filtering, sorting, and limiting. Prefers the engine's
 * `_rowId` (stable original row number — adapter rows are rebuilt on every
 * data emission); falls back to a WeakMap-backed object id, then the index.
 */
export function getStableRowId(row: unknown, fallbackIndex: number): number {
  if (typeof row !== 'object' || row === null) return fallbackIndex;
  const rawId = (row as Record<string, unknown>)._rowId;
  if (rawId != null) {
    const numeric = Number(rawId);
    if (!Number.isNaN(numeric)) return numeric;
  }
  let id = rowIds.get(row);
  if (id === undefined) {
    id = nextId--;
    rowIds.set(row, id);
  }
  return id;
}
