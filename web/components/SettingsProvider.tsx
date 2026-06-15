'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AMOUNT_COLOR_SCHEME, type AmountColorScheme } from '@/lib/amountColors';
import {
  fetchSettings,
  updateSettings as putSettings,
  type Settings,
} from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

type SettingsCtx = {
  settings: Settings;
  scheme: AmountColorScheme;
  loading: boolean;
  updateSettings: (next: Settings) => Promise<void>;
};

const defaultSettings: Settings = {
  default_currency: 'CNY',
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
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
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
  }, []);

  const value = useMemo(
    () => ({
      settings,
      scheme: settings.amount_color_scheme,
      loading,
      updateSettings,
    }),
    [settings, loading, updateSettings]
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
