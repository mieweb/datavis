import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { badgeVariants } from '@mieweb/ui/components/Badge';
import { useTranslation } from 'react-i18next';

import {
  usePrefs,
  type PerspectiveInfo,
  type PrefsInstance,
} from '../../adapters/use-prefs';

const STORAGE_PREFIX = 'mieweb-datavis:pinned-perspectives';
const CHANGE_EVENT = 'mieweb-datavis:pinned-perspectives-change';

// Whether pinned-perspective names may be persisted to localStorage. When false
// (an untrusted/public device), pins stay in memory for the session only and are
// never read from or written to storage — mirroring the Prefs `temporary`
// backend so the device-trust gate covers pins too. Provided by `DataGrid`.
const PinPersistenceContext = createContext(true);
export const PinnedPerspectivePersistenceProvider =
  PinPersistenceContext.Provider;

function getStorageKey(prefs: PrefsInstance): string {
  return `${STORAGE_PREFIX}:${prefs.name?.trim() || 'default'}`;
}

function readNames(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) return [];
    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeNames(
  storageKey: string,
  names: string[],
  persist: boolean,
): void {
  if (typeof window === 'undefined') return;
  if (persist) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(names));
    } catch {
      // Pinning remains available for the current session when storage is blocked.
    }
  }
  // Dispatched even when not persisting so multiple pill instances (title bar +
  // prefs toolbar) stay in sync within the session.
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: { storageKey, names },
  }));
}

export function usePinnedPerspectiveNames(
  prefs: PrefsInstance,
  perspectives: PerspectiveInfo[],
  persist = true,
) {
  const storageKey = useMemo(() => getStorageKey(prefs), [prefs]);
  const [names, setNames] = useState<string[]>(() =>
    persist ? readNames(storageKey) : [],
  );

  useEffect(() => {
    setNames(persist ? readNames(storageKey) : []);
  }, [storageKey, persist]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey: string; names: string[] }>).detail;
      if (detail?.storageKey === storageKey) setNames(detail.names);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setNames(readNames(storageKey));
    };

    window.addEventListener(CHANGE_EVENT, handleChange);
    // Cross-tab sync is only meaningful when pins are actually persisted.
    if (persist) window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      if (persist) window.removeEventListener('storage', handleStorage);
    };
  }, [storageKey, persist]);

  useEffect(() => {
    if (perspectives.length === 0) return;
    const availableNames = new Set(perspectives.map((perspective) => perspective.name));
    const validNames = names.filter((name) => availableNames.has(name));
    if (validNames.length === names.length) return;
    setNames(validNames);
    writeNames(storageKey, validNames, persist);
  }, [names, perspectives, storageKey, persist]);

  const toggle = useCallback((name: string) => {
    const nextNames = names.includes(name)
      ? names.filter((currentName) => currentName !== name)
      : [...names, name];
    setNames(nextNames);
    writeNames(storageKey, nextNames, persist);
  }, [names, storageKey, persist]);

  return { names, toggle };
}

export function PinnedPerspectivePills({ prefs }: { prefs: PrefsInstance }) {
  const { t } = useTranslation();
  const persist = useContext(PinPersistenceContext);
  const {
    perspectives,
    currentPerspectiveId,
    isUnsaved,
    selectPerspective,
  } = usePrefs(prefs);
  const { names } = usePinnedPerspectiveNames(prefs, perspectives, persist);
  const pinnedPerspectives = perspectives.filter((perspective) => names.includes(perspective.name));

  if (pinnedPerspectives.length === 0) return null;

  return (
    <div
      className="wcdv-perspective-pills flex shrink-0 items-center gap-1"
      role="group"
      aria-label={t('GRID_TOOLBAR.PREFS.PINNED') || 'Pinned perspectives'}
    >
      {pinnedPerspectives.map((perspective) => {
        const isCurrent = perspective.id === currentPerspectiveId;
        return (
          <button
            key={perspective.id}
            type="button"
            className={`${badgeVariants({
              variant: isCurrent ? 'default' : 'secondary',
              size: 'sm',
            })} focus-visible:ring-ring shrink-0 px-1.5 py-0 text-[10px] leading-4 focus-visible:ring-2 focus-visible:outline-none`}
            aria-pressed={isCurrent}
            onClick={() => selectPerspective(perspective.id)}
          >
            {isUnsaved && isCurrent ? `[*] ${perspective.name}` : perspective.name}
          </button>
        );
      })}
    </div>
  );
}