'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AMOUNT_COLOR_SCHEME, type AmountColorScheme } from '@/lib/amountColors';
import {
  fetchSettings,
  updateSettings as putSettings,
  type Settings,
} from '@/lib/api';
import { getStoredLocale, loadLocale, takeExplicitLocale, type Locale } from '@/lib/i18n/utils';
import {
  applyTheme,
  DEFAULT_THEME,
  getStoredTheme,
  isThemePreference,
  type ThemePreference,
} from '@/lib/theme';
import { useAuth } from '@/components/AuthProvider';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';

type SettingsCtx = {
  settings: Settings;
  scheme: AmountColorScheme;
  locale: string;
  theme: ThemePreference;
  loading: boolean;
  updateSettings: (next: Settings) => Promise<void>;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
};

const defaultSettings: Settings = {
  locale: 'zh-Hans',
  default_date_mode: 'today',
  amount_color_scheme: DEFAULT_AMOUNT_COLOR_SCHEME,
  theme: DEFAULT_THEME,
};

function viewerTheme(): ThemePreference {
  return getStoredTheme() ?? DEFAULT_THEME;
}

const SettingsContext = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { ownerId, isOwner, ready: ledgerReady } = useLedgerAccess();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme(viewerTheme());
  }, []);

  useEffect(() => {
    if (!user) {
      const stored = getStoredLocale();
      const theme = viewerTheme();
      applyTheme(theme);
      setSettings({
        ...defaultSettings,
        locale: stored ?? defaultSettings.locale,
        theme,
      });
      setLoading(false);
      return;
    }
    if (!ledgerReady) return;

    let cancelled = false;
    setLoading(true);
    fetchSettings()
      .then(async (data) => {
        if (cancelled) return;
        const themeFromServer = isThemePreference(data.theme) ? data.theme : DEFAULT_THEME;
        // Theme is per login user: only sync from own ledger; never apply another owner's theme.
        const theme = isOwner ? themeFromServer : viewerTheme();
        applyTheme(theme);

        const explicit = takeExplicitLocale();
        if (explicit && explicit !== data.locale && isOwner) {
          try {
            const saved = await putSettings({ ...data, locale: explicit, theme });
            if (!cancelled) {
              setSettings(saved);
              await loadLocale(saved.locale);
            }
            return;
          } catch {
            if (!cancelled) {
              setSettings({ ...data, locale: explicit, theme });
              await loadLocale(explicit);
            }
            return;
          }
        }
        if (!cancelled) {
          setSettings({ ...data, theme });
          await loadLocale(explicit ?? data.locale);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const theme = viewerTheme();
          applyTheme(theme);
          setSettings({ ...defaultSettings, theme });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, ownerId, ledgerReady, isOwner]);

  const updateSettings = useCallback(async (next: Settings) => {
    const saved = await putSettings(next);
    setSettings(saved);
    if (isThemePreference(saved.theme)) {
      applyTheme(saved.theme);
    }
    await loadLocale(saved.locale);
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    void loadLocale(locale);
    setSettings((prev) => ({ ...prev, locale }));
  }, []);

  const setTheme = useCallback((theme: ThemePreference) => {
    applyTheme(theme);
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      scheme: settings.amount_color_scheme,
      locale: settings.locale,
      theme: isThemePreference(settings.theme) ? settings.theme : DEFAULT_THEME,
      loading,
      updateSettings,
      setLocale,
      setTheme,
    }),
    [settings, loading, updateSettings, setLocale, setTheme]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside provider');
  return ctx;
}
