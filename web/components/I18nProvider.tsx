'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/src/i18n';
import { useSettings } from '@/components/SettingsProvider';
import { applyLocaleEarly, getLocaleWithFallback, loadLocale } from '@/lib/i18n/utils';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useSettings();
  const earlyAppliedRef = useRef(false);

  useLayoutEffect(() => {
    if (earlyAppliedRef.current) return;
    earlyAppliedRef.current = true;
    applyLocaleEarly();
  }, []);

  useEffect(() => {
    if (loading) return;
    const locale = getLocaleWithFallback(settings.locale);
    void loadLocale(locale);
  }, [settings.locale, loading]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
