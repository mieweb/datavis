/**
 * TransContext — React context for the `trans()` i18n function.
 *
 * Eliminates prop-drilling of `trans` through 20+ component layers.
 * DataGrid wraps its tree with `<TransProvider>`. Any component can
 * call `useTranslation()` to get the `t()` helper.
 *
 * Components still accept an optional `trans` prop as an override
 * (useful in Storybook or standalone usage outside DataGrid).
 */

import { createContext, useContext, type ReactNode } from 'react';

/** Signature shared by the legacy `trans()` and the React prop. */
export type TransFn = (key: string, ...args: unknown[]) => string;

/** Default identity translation — returns '' so `t(key) || 'fallback'` works. */
export const defaultTrans: TransFn = () => '';

const TransContext = createContext<TransFn>(defaultTrans);

// ───────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────

export interface TransProviderProps {
  /** The translation function to inject. */
  value: TransFn;
  children: ReactNode;
}

/**
 * Wrap a component tree to make `t()` available via `useTranslation()`.
 *
 * ```tsx
 * <TransProvider value={trans}>
 *   <DataGrid … />
 * </TransProvider>
 * ```
 */
export function TransProvider({ value, children }: TransProviderProps) {
  return (
    <TransContext.Provider value={value}>{children}</TransContext.Provider>
  );
}

// ───────────────────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────────────────

/**
 * Return the `t(key, …args)` translation function from context.
 *
 * If an explicit `overrideTrans` is provided (e.g. from a component
 * prop), it takes precedence over the context value.
 */
export function useTranslation(overrideTrans?: TransFn): TransFn {
  const contextTrans = useContext(TransContext);
  return overrideTrans ?? contextTrans;
}
