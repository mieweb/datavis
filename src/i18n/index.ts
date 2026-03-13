/**
 * i18n — public exports.
 *
 * Powered by i18next + react-i18next.
 * Side-effect import of './config' initializes i18next.
 */

// Initialize i18next (side-effect)
import './config';

// Re-export react-i18next hooks consumers need
export { useTranslation } from 'react-i18next';

// Re-export the i18n instance for imperative use (e.g. changeLanguage)
export { default as i18n } from './config';

// Keep LocaleProvider/useLocale for Intl number/date formatting
export {
  LocaleProvider,
  useLocale,
  type LocaleProviderProps,
} from './LocaleContext';
