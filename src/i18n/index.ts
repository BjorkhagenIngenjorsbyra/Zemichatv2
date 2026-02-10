import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import sv from './locales/sv.json';
import en from './locales/en.json';
import no from './locales/no.json';
import da from './locales/da.json';
import fi from './locales/fi.json';

export const supportedLanguages = [
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]['code'];

const supportedCodes: string[] = supportedLanguages.map((l) => l.code);

const resources = {
  sv: { translation: sv },
  en: { translation: en },
  no: { translation: no },
  nb: { translation: no },
  nn: { translation: no },
  da: { translation: da },
  fi: { translation: fi },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'sv',
    supportedLngs: ['sv', 'en', 'no', 'nb', 'nn', 'da', 'fi'],
    load: 'languageOnly',
    debug: import.meta.env.DEV,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'querystring', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'zemichat-language',
      lookupQuerystring: 'lang',
    },
  });

// Normalize Norwegian variants (nb/nn) to our canonical 'no' code.
// navigator.language returns 'nb' or 'nn' for Norwegian, not 'no'.
const detectedLang = i18n.language;
if (detectedLang === 'nb' || detectedLang === 'nn') {
  i18n.changeLanguage('no');
}

export default i18n;

/**
 * Change the current language.
 */
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
}

/**
 * Get the current language (normalized).
 */
export function getCurrentLanguage(): SupportedLanguage {
  const lang = i18n.language;
  if (lang === 'nb' || lang === 'nn') return 'no';
  if (supportedCodes.includes(lang)) return lang as SupportedLanguage;
  return 'sv';
}
