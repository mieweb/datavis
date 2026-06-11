/**
 * i18next configuration — initializes i18next with all supported locales.
 *
 * Import this module once (side-effect) before rendering React.
 * Components use `useTranslation()` from react-i18next.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from './en-US.json';
import esMX from './locales/es-MX.json';
import frFR from './locales/fr-FR.json';
import idID from './locales/id-ID.json';
import nlNL from './locales/nl-NL.json';
import ptBR from './locales/pt-BR.json';
import ruRU from './locales/ru-RU.json';
import thTH from './locales/th-TH.json';
import viVN from './locales/vi-VN.json';
import zhHansCN from './locales/zh-Hans-CN.json';

const resources = {
  'en-US':      { translation: enUS },
  'es-MX':      { translation: esMX },
  'fr-FR':      { translation: frFR },
  'id-ID':      { translation: idID },
  'nl-NL':      { translation: nlNL },
  'pt-BR':      { translation: ptBR },
  'ru-RU':      { translation: ruRU },
  'th-TH':      { translation: thTH },
  'vi-VN':      { translation: viVN },
  'zh-Hans-CN': { translation: zhHansCN },
} as const;

let didInit = false;

/**
 * Initialize i18next exactly once and return the shared instance.
 *
 * Explicit callers help prevent tree-shaking from removing locale resources
 * when this package is consumed as a library.
 */
export function ensureI18nInit() {
  if (didInit || i18n.isInitialized) {
    didInit = true;
    return i18n;
  }

  i18n.use(initReactI18next).init({
    resources,
    lng: 'en-US',
    fallbackLng: 'en-US',
    interpolation: {
      escapeValue: false,   // React already escapes
    },
    keySeparator: false,    // Keys use dots literally, not as nesting
    returnNull: false,
  });

  didInit = true;
  return i18n;
}

ensureI18nInit();

export default i18n;
