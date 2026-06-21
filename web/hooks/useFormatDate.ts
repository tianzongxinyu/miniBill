'use client';

import { useCallback, useMemo } from 'react';
import { useSettings } from '@/components/SettingsProvider';
import type { YearMonth } from '@/lib/api';
import {
  formatISODate as formatISODateForLocale,
  formatYearMonth as formatYearMonthForLocale,
  formatYearMonthShort as formatYearMonthShortForLocale,
} from '@/lib/formatDate';

export function useFormatDate() {
  const { locale } = useSettings();

  const formatISODate = useCallback(
    (iso: string) => formatISODateForLocale(iso, locale),
    [locale]
  );

  const formatYearMonth = useCallback(
    (ym: YearMonth) => formatYearMonthForLocale(ym, locale),
    [locale]
  );

  const formatYearMonthShort = useCallback(
    (ym: YearMonth) => formatYearMonthShortForLocale(ym, locale),
    [locale]
  );

  return useMemo(
    () => ({ formatISODate, formatYearMonth, formatYearMonthShort }),
    [formatISODate, formatYearMonth, formatYearMonthShort]
  );
}
