/**
 * a3t-backed Prefs backend for datavis-ace, with copy-on-write perspectives.
 *
 * This is the seam where DataVis NITRO perspectives are persisted through the
 * a3t universal asset loader instead of raw localStorage. It leans on a3t's
 * context-layer resolution to give the product three things:
 *
 *   1. Seeding default perspectives we ship out of the box (via a3t
 *      `seedDefaults`, which is idempotent and never clobbers user edits).
 *   2. Copy-on-write user edits: when a user changes a shipped default, the
 *      edit is written to a *more specific* context layer instead of mutating
 *      the seeded row, so the original default is always recoverable.
 *   3. A future-proof permission story: a server-side asset store can make the
 *      base ("default") layer read-only for normal users while still letting
 *      them write their own overrides in the user layer.
 *
 * ## Layering
 *
 * a3t resolves an asset from most-specific to least-specific context:
 *
 *   workspace+key  →  system+key  →  key
 *
 * We seed defaults at the base layer (`{ system: 'default' }`) and write user
 * edits at the user layer (`{ workspace: 'user' }`). Reading a perspective with
 * both layers in context returns the user override when present, otherwise the
 * shipped default. "Reset to default" simply removes the user-layer row.
 *
 * ## Keys
 *
 * Each perspective is its own asset plus a small per-Prefs index that tracks
 * ordering, the current selection, and which defaults have been overridden:
 *
 *   datavis/perspectives/<prefsId>/<id>.json   — one StoredPerspective
 *   datavis/perspectives/<prefsId>/index.json  — DefaultIndex / UserIndex
 */

import a3t from 'a3t/browser';
import { createMinimongoBackend, type A3tDbBackend } from 'a3t/minimongo';
import { IndexedDb, LocalStorageDb, MemoryDb, type MinimongoCollection, type MinimongoDb } from 'minimongo';
import { PREFS_BACKEND_REGISTRY } from 'datavis-ace';
import {
  deepEqual,
  emptyDefaultIndex,
  emptyUserIndex,
  mergeOrder,
  resolveCurrent,
  withId,
  withoutId,
  type DefaultIndex,
  type UserIndex,
} from './perspective-index';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface StoredPerspective {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

/**
 * Blob shape used to *seed* defaults. Kept for ergonomic authoring of shipped
 * perspectives; it is decomposed into per-perspective keys + an index on seed.
 */
export interface PerspectiveBlob {
  current: string | null;
  perspectives: Record<string, StoredPerspective>;
}

/** Per-Prefs view of which perspectives are shipped, overridden, or custom. */
export interface PerspectiveMeta {
  /** Shipped default ids (cannot be renamed or deleted by normal users). */
  defaults: string[];
  /** Shipped defaults the user has modified (eligible for "Reset to default"). */
  overridden: string[];
  /** Ids of perspectives the user created themselves. */
  userCreated: string[];
  /** Currently selected perspective id. */
  current: string | null;
}

/** Minimal shape of the datavis-ace Perspective passed to backend.save(). */
interface PerspectiveLike {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

type BoolCont = (ok: boolean) => void;

const KEY_PREFIX = 'datavis/perspectives';
const COLLECTION_NAME = 'assets';
const BACKEND_TYPE = 'a3t';

// Context layers. a3t.set/remove use ONLY the override to build the write query,
// while a3t.get merges the override with the (empty) global context, so these
// constants fully determine which layer each operation touches.
const DEFAULT_SYSTEM = 'default';
const USER_WORKSPACE = 'user';
/** Base layer: shipped defaults (read-only for normal users on a server backend). */
const BASE_CTX = { system: DEFAULT_SYSTEM } as const;
/** User layer: copy-on-write overrides and user-created perspectives. */
const USER_CTX = { workspace: USER_WORKSPACE } as const;
/** Resolve layer: user override wins, else shipped default. */
const RESOLVE_CTX = { workspace: USER_WORKSPACE, system: DEFAULT_SYSTEM } as const;

function perspKeyFor(prefsId: string, id: string): string {
  return `${KEY_PREFIX}/${prefsId}/${id}.json`;
}

function indexKeyFor(prefsId: string): string {
  return `${KEY_PREFIX}/${prefsId}/index.json`;
}

// ───────────────────────────────────────────────────────────
// Shared a3t + minimongo setup (one per page)
// ───────────────────────────────────────────────────────────

let dbBackend: A3tDbBackend | null = null;
let readyPromise: Promise<void> | null = null;

function createCollection(namespace: string): Promise<MinimongoCollection> {
  return new Promise((resolve, reject) => {
    // minimongo invokes the success callback with the db instance, so we use
    // that argument rather than the not-yet-assigned local.
    const addCollection = (db: MinimongoDb) =>
      db.addCollection(COLLECTION_NAME, () => resolve(db.collections[COLLECTION_NAME]), reject);

    // Prefer IndexedDB (larger quota, async, structured), then fall back to
    // localStorage, then to in-memory if neither is available.
    const useMemory = () => new MemoryDb(undefined, addCollection);

    const useLocalStorage = () => {
      try {
        new LocalStorageDb({ namespace }, addCollection, useMemory);
      } catch {
        useMemory();
      }
    };

    try {
      new IndexedDb({ namespace }, addCollection, useLocalStorage);
    } catch {
      useLocalStorage();
    }
  });
}

/**
 * Initialize the shared a3t instance with a minimongo DB backend. Safe to call
 * repeatedly; setup runs exactly once.
 */
export function ensureA3tReady(namespace = 'datavis-perspectives'): Promise<void> {
  if (!readyPromise) {
    readyPromise = createCollection(namespace).then((collection) => {
      dbBackend = createMinimongoBackend(collection);
      a3t.init({ db: { backend: dbBackend }, logging: { enabled: false } });
    });
  }
  return readyPromise;
}

/**
 * Seed the out-of-the-box perspectives for a Prefs instance at the base layer.
 * Idempotent: existing seeded rows (and any user overrides) are never clobbered.
 * The authoring blob is decomposed into one asset per perspective plus an index.
 */
export async function seedPerspectiveDefaults(prefsId: string, blob: PerspectiveBlob): Promise<void> {
  await ensureA3tReady();
  const order = Object.keys(blob.perspectives);
  const entries: Array<{ key: string; value: unknown; system: string }> = order.map((id) => ({
    key: perspKeyFor(prefsId, id),
    value: blob.perspectives[id],
    system: DEFAULT_SYSTEM,
  }));
  const index: DefaultIndex = { order, current: blob.current ?? null };
  entries.push({ key: indexKeyFor(prefsId), value: index, system: DEFAULT_SYSTEM });
  await dbBackend!.seedDefaults(entries);
}

// ───────────────────────────────────────────────────────────
// Stateless copy-on-write operations (keyed by prefsId)
//
// These read/write a3t fresh on each call and rely on a3t's nonce-busting
// cache for speed. Keeping them stateless lets both the PrefsBackend class and
// the demo UI ("Reset to default") drive the same behaviour without sharing a
// cached instance that could drift.
// ───────────────────────────────────────────────────────────

async function readBaseIndex(prefsId: string): Promise<DefaultIndex> {
  await ensureA3tReady();
  const idx = await a3t.get<DefaultIndex>(indexKeyFor(prefsId), emptyDefaultIndex(), BASE_CTX);
  return idx ?? emptyDefaultIndex();
}

async function readUserIndex(prefsId: string): Promise<UserIndex> {
  await ensureA3tReady();
  // USER_CTX only resolves the user layer (no system fallback), so an unedited
  // Prefs instance yields the inline empty index rather than the seeded one.
  const idx = await a3t.get<UserIndex>(indexKeyFor(prefsId), emptyUserIndex(), USER_CTX);
  return { ...emptyUserIndex(), ...(idx ?? {}) };
}

async function writeUserIndex(prefsId: string, idx: UserIndex): Promise<void> {
  await ensureA3tReady();
  await a3t.set(indexKeyFor(prefsId), idx, USER_CTX);
}

/** Resolve a single perspective: user override wins, else shipped default. */
async function loadPerspective(prefsId: string, id: string): Promise<StoredPerspective | null> {
  await ensureA3tReady();
  const persp = await a3t.get<StoredPerspective | null>(perspKeyFor(prefsId, id), null, RESOLVE_CTX);
  return persp ?? null;
}

/** Read the original shipped version of a perspective, ignoring user edits. */
export async function loadSeededPerspective(prefsId: string, id: string): Promise<StoredPerspective | null> {
  await ensureA3tReady();
  const persp = await a3t.get<StoredPerspective | null>(perspKeyFor(prefsId, id), null, BASE_CTX);
  return persp ?? null;
}

async function listPerspectiveIds(prefsId: string): Promise<string[]> {
  const [base, user] = await Promise.all([readBaseIndex(prefsId), readUserIndex(prefsId)]);
  return mergeOrder(base.order, user.order);
}

async function loadAllPerspectives(prefsId: string): Promise<Record<string, StoredPerspective>> {
  const ids = await listPerspectiveIds(prefsId);
  const resolved = await Promise.all(ids.map((id) => loadPerspective(prefsId, id)));
  const out: Record<string, StoredPerspective> = {};
  ids.forEach((id, i) => {
    const persp = resolved[i];
    if (persp) out[id] = persp;
  });
  return out;
}

async function getCurrentPerspectiveId(prefsId: string): Promise<string | null> {
  const [base, user] = await Promise.all([readBaseIndex(prefsId), readUserIndex(prefsId)]);
  return resolveCurrent(user.current, base.current);
}

async function setCurrentPerspectiveId(prefsId: string, id: string): Promise<void> {
  const user = await readUserIndex(prefsId);
  await writeUserIndex(prefsId, { ...user, current: id });
}

/**
 * Copy-on-write save. Editing a shipped default writes the change to the user
 * layer (the seeded row is untouched) and records the override; saving a new
 * perspective appends it to the user-created order. Saving a default with
 * content identical to its seeded version is treated as "reset" — no fork is
 * created (and any prior override is dropped), so initialization/no-op saves
 * never spuriously mark a default as modified.
 */
async function savePerspective(prefsId: string, perspective: PerspectiveLike): Promise<void> {
  await ensureA3tReady();
  const value: StoredPerspective = {
    id: perspective.id,
    name: perspective.name,
    config: structuredClone(perspective.config ?? {}),
  };
  const base = await readBaseIndex(prefsId);
  const isDefault = base.order.includes(perspective.id);

  if (isDefault) {
    const seeded = await loadSeededPerspective(prefsId, perspective.id);
    if (seeded && deepEqual(seeded, value)) {
      // Identical to the shipped default — ensure it is not forked.
      const user = await readUserIndex(prefsId);
      if (user.edited.includes(perspective.id)) {
        await a3t.remove(perspKeyFor(prefsId, perspective.id), USER_CTX);
        await writeUserIndex(prefsId, { ...user, edited: withoutId(user.edited, perspective.id) });
      }
      return;
    }
  }

  await a3t.set(perspKeyFor(prefsId, perspective.id), value, USER_CTX);
  const user = await readUserIndex(prefsId);
  const next: UserIndex = isDefault
    ? { ...user, edited: withId(user.edited, perspective.id) }
    : { ...user, order: withId(user.order, perspective.id) };
  await writeUserIndex(prefsId, next);
}

/** Rename a user-created perspective. Shipped defaults are not renamable. */
async function renameUserPerspective(prefsId: string, oldId: string, newId: string): Promise<boolean> {
  const base = await readBaseIndex(prefsId);
  if (base.order.includes(oldId)) return false; // defaults are immutable

  const existing = await loadPerspective(prefsId, oldId);
  if (!existing) return false;

  await ensureA3tReady();
  await a3t.set(perspKeyFor(prefsId, newId), { ...existing, id: newId, name: newId }, USER_CTX);
  await a3t.remove(perspKeyFor(prefsId, oldId), USER_CTX);

  const user = await readUserIndex(prefsId);
  await writeUserIndex(prefsId, {
    ...user,
    order: withId(withoutId(user.order, oldId), newId),
    current: user.current === oldId ? newId : user.current,
  });
  return true;
}

/** Delete a user-created perspective. Shipped defaults are not deletable. */
async function deleteUserPerspective(prefsId: string, id: string): Promise<boolean> {
  const base = await readBaseIndex(prefsId);
  if (base.order.includes(id)) return false; // defaults are immutable

  await ensureA3tReady();
  await a3t.remove(perspKeyFor(prefsId, id), USER_CTX);

  const user = await readUserIndex(prefsId);
  await writeUserIndex(prefsId, {
    ...user,
    order: withoutId(user.order, id),
    current: user.current === id ? null : user.current,
  });
  return true;
}

/**
 * Restore a shipped default by dropping its user-layer override. No-op (still
 * succeeds) for ids that are not overridden defaults.
 */
export async function resetPerspectiveToDefault(prefsId: string, id: string): Promise<boolean> {
  const base = await readBaseIndex(prefsId);
  if (!base.order.includes(id)) return false; // only shipped defaults can be reset

  await ensureA3tReady();
  await a3t.remove(perspKeyFor(prefsId, id), USER_CTX);

  const user = await readUserIndex(prefsId);
  await writeUserIndex(prefsId, { ...user, edited: withoutId(user.edited, id) });
  return true;
}

/** Remove all user state, returning the Prefs instance to shipped defaults. */
async function resetAllPerspectives(prefsId: string): Promise<void> {
  await ensureA3tReady();
  const user = await readUserIndex(prefsId);
  const userKeys = mergeOrder(user.order, user.edited);
  await Promise.all(userKeys.map((id) => a3t.remove(perspKeyFor(prefsId, id), USER_CTX)));
  await a3t.remove(indexKeyFor(prefsId), USER_CTX);
}

/** Snapshot of which perspectives are shipped, overridden, or user-created. */
export async function getPerspectiveMeta(prefsId: string): Promise<PerspectiveMeta> {
  const [base, user] = await Promise.all([readBaseIndex(prefsId), readUserIndex(prefsId)]);
  return {
    defaults: [...base.order],
    overridden: base.order.filter((id) => user.edited.includes(id)),
    userCreated: [...user.order],
    current: resolveCurrent(user.current, base.current),
  };
}

// ───────────────────────────────────────────────────────────
// PrefsBackend implementation
// ───────────────────────────────────────────────────────────

/**
 * datavis-ace PrefsBackend that maps each Prefs instance onto the copy-on-write
 * a3t operations above. Instantiated by Prefs via PREFS_BACKEND_REGISTRY.
 */
class A3tPrefsBackend {
  private readonly prefsId: string;

  constructor(id: string) {
    this.prefsId = id;
  }

  load(id: string, cont: (perspective: StoredPerspective | null) => void): void {
    loadPerspective(this.prefsId, id)
      .then((persp) => cont(persp))
      .catch(() => cont(null));
  }

  loadAll(cont: (perspectives: Record<string, StoredPerspective>) => void): void {
    loadAllPerspectives(this.prefsId)
      .then((perspectives) => cont(perspectives))
      .catch(() => cont({}));
  }

  save(perspective: PerspectiveLike, cont?: BoolCont): void {
    savePerspective(this.prefsId, perspective)
      .then(() => cont?.(true))
      .catch(() => cont?.(false));
  }

  getPerspectives(cont: (ids: string[]) => void): void {
    listPerspectiveIds(this.prefsId)
      .then((ids) => cont(ids))
      .catch(() => cont([]));
  }

  getCurrent(cont: (id: string | null) => void): void {
    getCurrentPerspectiveId(this.prefsId)
      .then((id) => cont(id))
      .catch(() => cont(null));
  }

  setCurrent(id: string, cont?: BoolCont): void {
    setCurrentPerspectiveId(this.prefsId, id)
      .then(() => cont?.(true))
      .catch(() => cont?.(false));
  }

  rename(oldName: string, newName: string, cont?: BoolCont): void {
    renameUserPerspective(this.prefsId, oldName, newName)
      .then((ok) => cont?.(ok))
      .catch(() => cont?.(false));
  }

  deletePerspective(id: string, cont?: BoolCont): void {
    deleteUserPerspective(this.prefsId, id)
      .then((ok) => cont?.(ok))
      .catch(() => cont?.(false));
  }

  reset(cont?: BoolCont): void {
    resetAllPerspectives(this.prefsId)
      .then(() => cont?.(true))
      .catch(() => cont?.(false));
  }
}

/**
 * Register the `'a3t'` Prefs backend type so it can be selected via
 * `new Prefs(name, null, { backend: { type: 'a3t' } })`. Idempotent.
 */
export function registerA3tPrefsBackend(): void {
  const registry = PREFS_BACKEND_REGISTRY as {
    isSet(type: string): boolean;
    set(type: string, ctor: unknown): void;
  };
  if (!registry.isSet(BACKEND_TYPE)) {
    registry.set(BACKEND_TYPE, A3tPrefsBackend);
  }
}

export { BACKEND_TYPE as A3T_PREFS_BACKEND_TYPE };
