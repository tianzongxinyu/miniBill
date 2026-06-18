import i18n, { BackendModule, FallbackLng, FallbackLngObjList } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { findNearestMatchedLanguage } from '@/lib/i18n/utils';

/** Keep in sync with scripts/i18n/locales.json and internal/i18n/locales.go */
export const locales = [
  'zh-Hans',
  'zh-Hant',
  'en',
  'ja',
  'ko',
  'es',
  'fr',
  'de',
  'pt-BR',
  'ru',
  'ar',
  'hi',
  'id',
  'vi',
  'th',
  'tr',
  'it',
  'nl',
  'pl',
  'uk',
] as const;

const fallbacks = {
  'zh-HK': ['zh-Hant', 'en'],
  'zh-TW': ['zh-Hant', 'en'],
  zh: ['zh-Hans', 'en'],
} as FallbackLngObjList;

const LazyImportPlugin: BackendModule = {
  type: 'backend',
  init: function () {},
  read: function (language, _, callback) {
    const matchedLanguage = findNearestMatchedLanguage(language);
    import(`./locales/${matchedLanguage}.json`)
      .then((translationModule: Record<string, unknown>) => {
        callback(null, (translationModule.default as Record<string, unknown>) ?? translationModule);
      })
      .catch(() => {
        import('./locales/en.json')
          .then((translationModule: Record<string, unknown>) => {
            callback(null, (translationModule.default as Record<string, unknown>) ?? translationModule);
          })
          .catch((error: unknown) => {
            callback(error as Error, false);
          });
      });
  },
};

export const i18nReady = i18n
  .use(LazyImportPlugin)
  .use(initReactI18next)
  .init({
    detection: {
      order: ['navigator'],
    },
    interpolation: {
      escapeValue: false,
    },
    fallbackLng: {
      ...fallbacks,
      ...{ default: ['en'] },
    } as FallbackLng,
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
    },
  });

export default i18n;
export type TLocale = (typeof locales)[number];
