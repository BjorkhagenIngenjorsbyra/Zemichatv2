import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Capacitor } from '@capacitor/core';

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

/**
 * Normalize a language code (e.g. 'sv-SE' → 'sv', 'nb' → 'no')
 * to a supported language, or undefined if not supported.
 */
function normalizeLanguage(code: string): string | undefined {
  const base = code.split('-')[0].toLowerCase();
  if (supportedCodes.includes(base)) return base;
  if (base === 'nb' || base === 'nn') return 'no';
  return undefined;
}

// Pre-detected device language, populated by detectDeviceLanguage()
let detectedDeviceLanguage: string | undefined;

/**
 * Custom i18next detector that returns the pre-fetched device language.
 * This enables async detection (Capacitor Device plugin) to integrate
 * with i18next's synchronous detector lookup.
 */
const capacitorDeviceDetector = {
  name: 'capacitorDevice',
  lookup(): string | undefined {
    return detectedDeviceLanguage;
  },
};

/**
 * Detect the device's language. Must be called before initI18n().
 *
 * Detection order:
 * 1. On native platforms: Capacitor Device.getLanguageCode() (reliable)
 * 2. On web: navigator.language (fallback)
 *
 * The result is stored internally and used by the capacitorDevice detector
 * during i18n initialization.
 */
export async function detectDeviceLanguage(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Device } = await import('@capacitor/device');
      const { value } = await Device.getLanguageCode();
      detectedDeviceLanguage = normalizeLanguage(value);
    } catch {
      // Plugin not available, fall through to navigator
    }
  }

  if (!detectedDeviceLanguage && typeof navigator !== 'undefined' && navigator.language) {
    detectedDeviceLanguage = normalizeLanguage(navigator.language);
  }
}

/**
 * Initialize i18n. Call after detectDeviceLanguage().
 *
 * Detection priority:
 * 1. localStorage – user's explicit choice
 * 2. querystring – ?lang=xx (used in invite links)
 * 3. capacitorDevice – device language (native or navigator)
 * 4. htmlTag – <html lang="xx">
 * 5. 'sv' – final fallback
 */
export async function initI18n(): Promise<void> {
  const detector = new LanguageDetector();
  detector.addDetector(capacitorDeviceDetector);

  await i18n
    .use(detector)
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
        order: ['localStorage', 'querystring', 'capacitorDevice', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'zemichat-language',
        lookupQuerystring: 'lang',
      },
    });
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
