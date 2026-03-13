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

i18n.use(initReactI18next).init({
  resources: {
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
  },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false,   // React already escapes
  },
  keySeparator: false,    // Keys use dots literally, not as nesting
  returnNull: false,
});

export default i18n;
