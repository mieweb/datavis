/**
 * Pure copy-on-write index logic for a3t-backed perspectives.
 *
 * Kept free of any a3t / minimongo / DOM imports so the merge rules can be unit
 * tested in a plain Node environment. The a3t Prefs backend composes these.
 *
 * Two index layers back every Prefs instance:
 *   - DefaultIndex: seeded at the base layer (shipped order + current).
 *   - UserIndex: written at the user layer to record copy-on-write state.
 */

/** Index seeded at the base layer: shipped order + shipped current selection. */
export interface DefaultIndex {
  order: string[];
  current: string | null;
}

/** Index written at the user layer to record copy-on-write user state. */
export interface UserIndex {
  /** User-created perspective ids, in creation order. */
  order: string[];
  /** User's current selection; falls back to the default when null. */
  current: string | null;
  /** Shipped-default ids the user has overridden (copy-on-write). */
  edited: string[];
}

export function emptyDefaultIndex(): DefaultIndex {
  return { order: [], current: null };
}

export function emptyUserIndex(): UserIndex {
  return { order: [], current: null, edited: [] };
}

/** Shipped defaults first, then user-created ids, de-duplicated. */
export function mergeOrder(baseOrder: string[], userOrder: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...baseOrder, ...userOrder]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

/** The user's selection takes precedence over the shipped default. */
export function resolveCurrent(userCurrent: string | null, baseCurrent: string | null): string | null {
  return userCurrent ?? baseCurrent ?? null;
}

export function withId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

export function withoutId(ids: string[], id: string): string[] {
  return ids.filter((existing) => existing !== id);
}

/**
 * Deterministic JSON with recursively sorted object keys, so two structurally
 * equal values compare equal regardless of key insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

/** Structural equality for JSON-serialisable values, key-order independent. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

