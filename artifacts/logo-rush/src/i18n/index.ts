import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './locales/fr';
import en from './locales/en';

export const SUPPORTED_LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Always starts in French (the game's original/primary audience) unless the
// player has explicitly switched language before — deliberately not
// auto-detected from the browser locale, so an English-configured browser
// doesn't silently flip a French visitor's UI to English on first load.
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LOCALES,
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'logo-rush-locale',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18next;
