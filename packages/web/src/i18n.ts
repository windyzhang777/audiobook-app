import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from '@audiobook/shared';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already protects from XSS
  },
  debug: true, // Logs missing keys to the console
});

export default i18n;
