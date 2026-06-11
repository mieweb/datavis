/**
 * usePrefs — React hook wrapping wcdatavis Prefs for perspective management.
 */

import { useState, useCallback, useEffect } from 'react';
import { useDataVisEvents, type EventEmitter } from './event-bridge';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface PerspectiveInfo {
  id: string;
  name: string;
  config?: unknown;
  isTemporary?: boolean;
  isEssential?: boolean;
  isUnsaved?: boolean;
}

interface RawPerspective {
  id: string;
  name?: string;
  config?: unknown;
  opts?: {
    isTemporary?: boolean;
    isEssential?: boolean;
  };
  isUnsaved?: boolean;
}

export interface PrefsInstance extends EventEmitter {
  reset(): void;
  back(): void;
  forward(): void;
  addPerspective(...args: unknown[]): void;
  deletePerspective(id: string, cont?: (ok: boolean) => void): void;
  renamePerspective(id: string, name: string, cont?: (ok: boolean) => void): void;
  setCurrentPerspective(id: string, cont?: (ok: boolean) => void): void;
  clonePerspective(...args: unknown[]): void;
  save?(cont?: (ok: boolean) => void): void;
  reallySave?(cont?: (ok: boolean) => void): void;
  prime?(cont?: (ok: boolean) => void): void;
  getPerspectives(cont: (ids: string[]) => void): void;
  getCurrentPerspective?(): PerspectiveInfo | null;
  currentPerspective?: RawPerspective | null;
  perspectives?: Record<string, RawPerspective>;
  availablePerspectives?: string[];
}

// ───────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────

export interface UsePrefsState {
  perspectives: PerspectiveInfo[];
  currentPerspectiveId: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  isUnsaved: boolean;
}

export interface UsePrefsReturn extends UsePrefsState {
  prefs: PrefsInstance;
  reset: () => void;
  back: () => void;
  forward: () => void;
  selectPerspective: (id: string) => void;
  addPerspective: (name: string) => void;
  deletePerspective: (id: string) => void;
  renamePerspective: (id: string, name: string) => void;
  clonePerspective: () => void;
  save: () => void;
}

function normalizePerspective(raw: RawPerspective): PerspectiveInfo {
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    config: raw.config,
    isTemporary: !!raw.opts?.isTemporary,
    isEssential: !!raw.opts?.isEssential,
    isUnsaved: !!raw.isUnsaved,
  };
}

function getCurrentPerspective(prefs: PrefsInstance): RawPerspective | null {
  const current = prefs.currentPerspective;
  if (current?.id) {
    return current;
  }

  if (typeof prefs.getCurrentPerspective === 'function') {
    const legacyCurrent = prefs.getCurrentPerspective();
    if (legacyCurrent?.id) {
      return {
        id: legacyCurrent.id,
        name: legacyCurrent.name,
        config: legacyCurrent.config,
        opts: {
          isTemporary: legacyCurrent.isTemporary,
          isEssential: legacyCurrent.isEssential,
        },
        isUnsaved: legacyCurrent.isUnsaved,
      };
    }
  }

  return null;
}

function getPerspectiveList(prefs: PrefsInstance): PerspectiveInfo[] {
  const fromMap = prefs.perspectives ?? {};
  const ids: string[] = [];

  if (Array.isArray(prefs.availablePerspectives)) {
    ids.push(...prefs.availablePerspectives);
  } else {
    prefs.getPerspectives((availableIds) => {
      ids.push(...availableIds);
    });
  }

  return ids
    .map((id) => {
      const raw = fromMap[id] ?? ({ id } as RawPerspective);
      return normalizePerspective(raw);
    })
    .filter((p) => !!p.id);
}

/**
 * React hook wrapping wcdatavis Prefs with reactive state for perspective management.
 */
export function usePrefs(prefs: PrefsInstance): UsePrefsReturn {
  const [state, setState] = useState<UsePrefsState>({
    perspectives: [],
    currentPerspectiveId: null,
    canGoBack: false,
    canGoForward: false,
    isUnsaved: false,
  });

  const syncState = useCallback(() => {
    const current = getCurrentPerspective(prefs);
    const perspectives = getPerspectiveList(prefs);

    setState((s) => ({
      ...s,
      perspectives,
      currentPerspectiveId: current?.id ?? null,
      isUnsaved: !!current?.isUnsaved,
    }));
  }, [prefs]);

  useEffect(() => {
    syncState();
  }, [syncState]);

  useDataVisEvents(prefs, {
    primed: syncState,
    moduleBound: syncState,
    perspectiveAdded: syncState,
    perspectiveDeleted: syncState,
    perspectiveRenamed: syncState,
    perspectiveChanged: syncState,
    prefsReset: syncState,
    prefsChanged: () => {
      setState((s) => ({ ...s, isUnsaved: true }));
    },
    prefsSaved: () => {
      setState((s) => ({ ...s, isUnsaved: false }));
    },
    prefsHistoryStatus: (forward: unknown, back: unknown) => {
      setState((s) => ({
        ...s,
        canGoBack: !!back,
        canGoForward: !!forward,
      }));
    },
  });

  const callSave = useCallback(() => {
    if (typeof prefs.reallySave === 'function') {
      prefs.reallySave();
      return;
    }
    prefs.save?.();
  }, [prefs]);

  const callAddPerspective = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (prefs.addPerspective.length > 1) {
      prefs.addPerspective(null, trimmed, null, null, () => {
        callSave();
        syncState();
      });
      return;
    }

    prefs.addPerspective(trimmed);
  }, [prefs, callSave, syncState]);

  return {
    ...state,
    prefs,
    reset: useCallback(() => prefs.reset(), [prefs]),
    back: useCallback(() => prefs.back(), [prefs]),
    forward: useCallback(() => prefs.forward(), [prefs]),
    selectPerspective: useCallback((id: string) => prefs.setCurrentPerspective(id), [prefs]),
    addPerspective: callAddPerspective,
    deletePerspective: useCallback((id: string) => prefs.deletePerspective(id), [prefs]),
    renamePerspective: useCallback((id: string, name: string) => prefs.renamePerspective(id, name), [prefs]),
    clonePerspective: useCallback(() => prefs.clonePerspective(), [prefs]),
    save: callSave,
  };
}
