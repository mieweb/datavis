/**
 * LanguageSelector — locale picker for the DataVis grid.
 *
 * Uses @mieweb/ui Select to present the 10 supported locales.
 * On change, sets `window.DATAVIS_LANG` (the legacy global used by
 * `trans()`) and fires the `onLanguageChange` callback so the
 * host application can re-render with the new locale.
 */

import { Select } from '@mieweb/ui/components/Select';
import { useTranslation, type TransFn } from '../i18n';

// ───────────────────────────────────────────────────────────
// Supported locales — mirrors wcdatavis/src/trans.js registry
// ───────────────────────────────────────────────────────────

export interface LocaleEntry {
  /** BCP-47 code matching the TSV filename (e.g. 'es-MX'). */
  code: string;
  /** Native name shown in the dropdown. */
  name: string;
  /** Optional flag emoji. */
  flag?: string;
}

export const SUPPORTED_LOCALES: LocaleEntry[] = [
  { code: 'en-US', name: 'English',    flag: '🇺🇸' },
  { code: 'es-MX', name: 'Español',    flag: '🇲🇽' },
  { code: 'fr-FR', name: 'Français',   flag: '🇫🇷' },
  { code: 'id-ID', name: 'Bahasa',     flag: '🇮🇩' },
  { code: 'nl-NL', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt-BR', name: 'Português',  flag: '🇧🇷' },
  { code: 'ru-RU', name: 'Русский',    flag: '🇷🇺' },
  { code: 'th-TH', name: 'ไทย',       flag: '🇹🇭' },
  { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh-Hans-CN', name: '简体中文', flag: '🇨🇳' },
];

/** Build Select-compatible options from locale list. */
const LOCALE_OPTIONS = SUPPORTED_LOCALES.map((l) => ({
  value: l.code,
  label: `${l.flag ?? ''} ${l.name}`.trim(),
}));

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    DATAVIS_LANG?: string;
  }
}

export interface LanguageSelectorProps {
  /** Current locale code (BCP-47, e.g. 'en-US'). */
  value?: string;
  /** Called when the user picks a new locale. */
  onLanguageChange?: (code: string) => void;
  /** i18n override. */
  trans?: TransFn;
  /** Extra CSS class. */
  className?: string;
}

export function LanguageSelector({
  value,
  onLanguageChange,
  trans: transProp,
  className,
}: LanguageSelectorProps) {
  const t = useTranslation(transProp);

  const handleChange = (code: string) => {
    // Update the legacy global so `trans()` reads the new locale.
    window.DATAVIS_LANG = code;
    onLanguageChange?.(code);
  };

  return (
    <Select
      options={LOCALE_OPTIONS}
      value={value ?? window.DATAVIS_LANG ?? 'en-US'}
      onValueChange={handleChange}
      placeholder={t('LANG.SELECT') || 'Language'}
      label={t('LANG.SELECT') || 'Language'}
      hideLabel
      size="sm"
      className={className}
      aria-label={t('LANG.SELECT') || 'Language'}
    />
  );
}
