import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de';
import en from './locales/en';
import fr from './locales/fr';
import it from './locales/it';
import zhHans from './locales/zh-Hans';

export const defaultNS = 'common';
export const resources = {
  de,
  en,
  fr,
  it,
  'zh-Hans': zhHans,
} as const;

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: ['common', 'dialogs', 'nodes', 'errors', 'debug', 'panels', 'simulator'],

  interpolation: {
    escapeValue: false, // React already escapes values
  },

  returnNull: false,
});

export default i18n;
