/**
 * usePrefs — React hook wrapping wcdatavis Prefs for perspective management.
 */

import { useState, useCallback } from 'react';
import { useDataVisEvents, type EventEmitter } from './event-bridge';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface PrefsInstance extends EventEmitter {
  reset(): void;
  back(): void;
  forward(): void;
  addPerspective(name: string): void;
  deletePerspective(id: string): void;
  renamePerspective(id: string, name: string): void;
  setCurrentPerspective(id: string): void;
  clonePerspective(): void;
  reallySave(): void;
  getPerspectives(): PerspectiveInfo[];
  getCurrentPerspective(): PerspectiveInfo | null;
}

export interface PerspectiveInfo {
  id: string;
  name: string;
  isTemporary?: boolean;
  isEssential?: boolean;
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

  useDataVisEvents(prefs, {
    perspectiveAdded: () => {
      setState((s) => ({
        ...s,
        perspectives: prefs.getPerspectives(),
      }));
    },
    perspectiveDeleted: () => {
      setState((s) => ({
        ...s,
        perspectives: prefs.getPerspectives(),
        currentPerspectiveId: prefs.getCurrentPerspective()?.id ?? null,
      }));
    },
    perspectiveRenamed: () => {
      setState((s) => ({
        ...s,
        perspectives: prefs.getPerspectives(),
      }));
    },
    perspectiveChanged: () => {
      setState((s) => ({
        ...s,
        currentPerspectiveId: prefs.getCurrentPerspective()?.id ?? null,
        isUnsaved: false,
      }));
    },
    prefsReset: () => {
      setState((s) => ({
        ...s,
        perspectives: prefs.getPerspectives(),
        currentPerspectiveId: prefs.getCurrentPerspective()?.id ?? null,
        isUnsaved: false,
      }));
    },
    prefsChanged: () => {
      setState((s) => ({ ...s, isUnsaved: true }));
    },
    prefsSaved: () => {
      setState((s) => ({ ...s, isUnsaved: false }));
    },
    prefsHistoryStatus: (back: unknown, forward: unknown) => {
      setState((s) => ({
        ...s,
        canGoBack: !!back,
        canGoForward: !!forward,
      }));
    },
  });

  return {
    ...state,
    prefs,
    reset: useCallback(() => prefs.reset(), [prefs]),
    back: useCallback(() => prefs.back(), [prefs]),
    forward: useCallback(() => prefs.forward(), [prefs]),
    selectPerspective: useCallback((id: string) => prefs.setCurrentPerspective(id), [prefs]),
    addPerspective: useCallback((name: string) => prefs.addPerspective(name), [prefs]),
    deletePerspective: useCallback((id: string) => prefs.deletePerspective(id), [prefs]),
    renamePerspective: useCallback((id: string, name: string) => prefs.renamePerspective(id, name), [prefs]),
    clonePerspective: useCallback(() => prefs.clonePerspective(), [prefs]),
    save: useCallback(() => prefs.reallySave(), [prefs]),
  };
}
