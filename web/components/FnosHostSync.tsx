'use client';

import { useEffect } from 'react';
import {
  findNearestMatchedLanguage,
  getStoredLocale,
  loadLocale,
} from '@/lib/i18n/utils';
import { getFnosSdk, isFnosHost } from '@/lib/fnos/sdk';
import {
  applyHostThemeIfSystem,
  getStoredTheme,
  type ResolvedTheme,
} from '@/lib/theme';

function isResolvedTheme(value: unknown): value is ResolvedTheme {
  return value === 'light' || value === 'dark';
}

/**
 * Sync locale/theme from fnOS host when available.
 * Locale: seed only when minibill-locale is unset.
 * Theme: only while preference is `system`.
 */
export function FnosHostSync() {
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      const sdk = await getFnosSdk();
      if (!sdk || cancelled) return;

      try {
        const config = await sdk.getPlatformConfig();
        if (cancelled) return;

        if (!getStoredLocale() && config.language) {
          const locale = findNearestMatchedLanguage(config.language);
          await loadLocale(locale);
        }

        if (isResolvedTheme(config.theme)) {
          applyHostThemeIfSystem(config.theme);
        }
      } catch {
        /* not in host / unsupported */
      }

      const onHost = await isFnosHost();
      if (!onHost || cancelled) return;

      const onLanguage = (language: string) => {
        if (getStoredLocale()) return;
        if (!language) return;
        void loadLocale(findNearestMatchedLanguage(language));
      };
      const onTheme = (theme: string) => {
        if ((getStoredTheme() ?? 'light') !== 'system') return;
        if (!isResolvedTheme(theme)) return;
        applyHostThemeIfSystem(theme);
      };

      try {
        await sdk.$on('os/language', onLanguage);
        cleanups.push(() => {
          void sdk.$off('os/language', onLanguage);
        });
      } catch {
        /* unsupported */
      }
      try {
        await sdk.$on('os/theme', onTheme);
        cleanups.push(() => {
          void sdk.$off('os/theme', onTheme);
        });
      } catch {
        /* unsupported */
      }
    })();

    return () => {
      cancelled = true;
      for (const fn of cleanups) fn();
    };
  }, []);

  return null;
}
