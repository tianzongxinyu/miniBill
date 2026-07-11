'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AMOUNT_COLOR_SCHEME, type AmountColorScheme } from '@/lib/amountColors';
import {
  fetchSettings,
  updateSettings as putSettings,
  type Settings,
} from '@/lib/api';
import { getStoredLocale, loadLocale, takeExplicitLocale, type Locale } from '@/lib/i18n/utils';
import { useAuth } from '@/components/AuthProvider';

type SettingsCtx = {
  settings: Settings;
  scheme: AmountColorScheme;
  locale: string;
  loading: boolean;
  updateSettings: (next: Settings) => Promise<void>;
  setLocale: (locale: Locale) => void;
};

const defaultSettings: Settings = {
  locale: 'zh-Hans',
  default_date_mode: 'today',
  amount_color_scheme: DEFAULT_AMOUNT_COLOR_SCHEME,
};

const SettingsContext = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      const stored = getStoredLocale();
      setSettings({ ...defaultSettings, locale: stored ?? defaultSettings.locale });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchSettings()
      .then(async (data) => {
        if (cancelled) return;
        const explicit = takeExplicitLocale();
        if (explicit && explicit !== data.locale) {
          try {
            const saved = await putSettings({ ...data, locale: explicit });
            if (!cancelled) {
              setSettings(saved);
              await loadLocale(saved.locale);
            }
            return;
          } catch {
            if (!cancelled) {
              setSettings({ ...data, locale: explicit });
              await loadLocale(explicit);
            }
            return;
          }
        }
        if (!cancelled) {
          setSettings(data);
          await loadLocale(explicit ?? data.locale);
        }
      })
      .catch(() => {
        if (!cancelled) setSettings(defaultSettings);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateSettings = useCallback(async (next: Settings) => {
    const saved = await putSettings(next);
    setSettings(saved);
    await loadLocale(saved.locale);
  }, []);

  const setLocale = useCallback((locale: Locale) => {
    void loadLocale(locale);
    setSettings((prev) => ({ ...prev, locale }));
  }, []);

  const value = useMemo(
    () => ({
      settings,
      scheme: settings.amount_color_scheme,
      locale: settings.locale,
      loading,
      updateSettings,
      setLocale,
    }),
    [settings, loading, updateSettings, setLocale]
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
