import { FallbackLngObjList } from 'i18next';
import i18n, { i18nReady, locales, type TLocale } from '@/src/i18n';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

export const LOCALE_STORAGE_KEY = 'minibill-locale';
/** Set when user picks language on login/register; synced to account settings after auth. */
export const LOCALE_EXPLICIT_KEY = 'minibill-locale-explicit';

export type Locale = TLocale;

export const getStoredLocale = (): Locale | null => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored && locales.includes(stored as TLocale) ? (stored as Locale) : null;
  } catch {
    return null;
  }
};

const setStoredLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be unavailable
  }
};

/** Remember explicit language choice on auth pages for post-login sync. */
export const markLocaleExplicit = (locale: Locale): void => {
  try {
    sessionStorage.setItem(LOCALE_EXPLICIT_KEY, locale);
  } catch {
    // sessionStorage might be unavailable
  }
};

/** Read and clear explicit locale pending account sync. */
export const takeExplicitLocale = (): Locale | null => {
  try {
    const value = sessionStorage.getItem(LOCALE_EXPLICIT_KEY);
    sessionStorage.removeItem(LOCALE_EXPLICIT_KEY);
    return value && isValidLocale(value) ? (value as Locale) : null;
  } catch {
    return null;
  }
};

export const isValidLocale = (locale: string | undefined | null): boolean => {
  if (!locale) return false;
  return locales.includes(locale as TLocale);
};

export const findNearestMatchedLanguage = (language: string): Locale => {
  if (locales.includes(language as TLocale)) {
    return language as Locale;
  }

  const i18nFallbacks = Object.entries(i18n.store.options.fallbackLng as FallbackLngObjList);
  for (const [main, chain] of i18nFallbacks) {
    if (language === main) {
      return chain[0] as Locale;
    }
  }

  const shortCode = language.substring(0, 2);
  if (locales.includes(shortCode as TLocale)) {
    return shortCode as Locale;
  }

  for (const existing of locales) {
    if (shortCode === existing.substring(0, 2)) {
      return existing as Locale;
    }
  }

  return (i18n.store.options.fallbackLng as FallbackLngObjList).default[0] as Locale;
};

export const getLocaleWithFallback = (userLocale?: string): Locale => {
  if (userLocale && isValidLocale(userLocale)) {
    return userLocale as Locale;
  }

  const stored = getStoredLocale();
  if (stored) {
    return stored;
  }

  if (typeof navigator !== 'undefined') {
    return findNearestMatchedLanguage(navigator.language);
  }

  return 'en';
};

export const loadLocale = async (locale: string): Promise<Locale> => {
  const validLocale = isValidLocale(locale)
    ? (locale as Locale)
    : findNearestMatchedLanguage(typeof navigator !== 'undefined' ? navigator.language : 'en');
  setStoredLocale(validLocale);
  await i18nReady;
  await i18n.changeLanguage(validLocale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = toIntlLocale(validLocale);
  }
  return validLocale;
};

/** Apply locale early during initial page load to prevent language flash. */
export const applyLocaleEarly = (): void => {
  const stored = getStoredLocale();
  const locale =
    stored ??
    (typeof navigator !== 'undefined' ? findNearestMatchedLanguage(navigator.language) : 'en');
  void loadLocale(locale);
};

export const getLocaleDisplayName = (locale: string): string => {
  try {
    const displayName = new Intl.DisplayNames([toIntlLocale(locale)], { type: 'language' }).of(locale);
    if (displayName) {
      return displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
  } catch {
    // Intl.DisplayNames might fail for some locales
  }
  return locale;
};

export const normalizeLocaleSearchText = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
};

const getLocaleDisplayNameForLanguage = (locale: string, displayLanguage: string): string => {
  try {
    return new Intl.DisplayNames([toIntlLocale(displayLanguage)], { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
};

export const getLocaleSearchLabels = (locale: string, uiLocale: string): string[] => {
  return Array.from(
    new Set([
      locale,
      getLocaleDisplayNameForLanguage(locale, locale),
      getLocaleDisplayNameForLanguage(locale, 'en'),
      getLocaleDisplayNameForLanguage(locale, uiLocale),
    ])
  );
};

export const localeMatchesSearch = (locale: string, query: string, uiLocale: string): boolean => {
  const normalizedQuery = normalizeLocaleSearchText(query.trim());
  if (!normalizedQuery) return true;

  return getLocaleSearchLabels(locale, uiLocale).some((label) =>
    normalizeLocaleSearchText(label).includes(normalizedQuery)
  );
};

export const getActiveLocale = (): Locale => {
  const current = i18n.language;
  return isValidLocale(current) ? (current as Locale) : findNearestMatchedLanguage(current || 'en');
};
