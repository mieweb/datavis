/**
 * LocaleContext — React context for the active BCP-47 locale code.
 *
 * Used by table renderers to format numbers (`toLocaleString`) and
 * dates (`toLocaleDateString`) consistently with the language chosen
 * in `<LanguageSelector>`.
 *
 * When no locale is explicitly set the context defaults to `undefined`,
 * which tells the Intl API to use the browser's system locale.
 *
 * DataGrid wraps its tree with `<LocaleProvider>`.  Any component can
 * call `useLocale()` to get the current BCP-47 tag (or `undefined`).
 */

import { createContext, useContext, type ReactNode } from 'react';

const LocaleCtx = createContext<string | undefined>(undefined);

// ───────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────

export interface LocaleProviderProps {
  /** BCP-47 locale code, e.g. `'en-US'`, `'fr-FR'`.  `undefined` = browser default. */
  value: string | undefined;
  children: ReactNode;
}

/**
 * Wrap a component tree to make the active locale available via `useLocale()`.
 *
 * ```tsx
 * <LocaleProvider value="en-US">
 *   <DataGrid … />
 * </LocaleProvider>
 * ```
 */
export function LocaleProvider({ value, children }: LocaleProviderProps) {
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

// ───────────────────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────────────────

/**
 * Return the active BCP-47 locale from context, or `undefined`
 * (which means "use browser default" in `Intl` APIs).
 */
export function useLocale(): string | undefined {
  return useContext(LocaleCtx);
}
