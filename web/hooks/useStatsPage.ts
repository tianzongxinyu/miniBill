'use client';

import { useCallback, useState, type RefObject } from 'react';
import { useStatsSeriesScroll } from '@/hooks/useStatsSeriesScroll';
import { useDebouncedSearchFilter } from '@/hooks/useDebouncedSearchFilter';
import {
  fetchMonthSeries,
  fetchYearSeries,
  type MonthSeriesPoint,
  type YearSeriesPoint,
} from '@/lib/api';
import { useOnLedgerChanged } from '@/lib/ledgerEvents';
import { fetchMonthSeriesPoint } from '@/lib/monthSeries';

export const monthSeriesKey = (m: MonthSeriesPoint) =>
  `${m.year}-${String(m.month).padStart(2, '0')}`;

export const yearSeriesKey = (y: YearSeriesPoint) => String(y.year);

export const STATS_SERIES_CONFIG = {
  month: { limit: 12, pointWidth: 28 },
  year: { limit: 10, pointWidth: 32 },
} as const;

type UseStatsPageOptions = {
  autoFillViewport?: boolean;
  getPointWidth?: () => number;
};

export function useStatsPage(
  scrollRef?: RefObject<HTMLDivElement | null>,
  options?: UseStatsPageOptions
) {
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const {
    noteQuery,
    setNoteQuery,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    searchActive,
    searchFilter,
    clearSearch,
  } = useDebouncedSearchFilter();

  const monthFetch = useCallback(
    (opts: { limit: number; cursor?: string; after?: string; searchFilter: typeof searchFilter }) =>
      fetchMonthSeries({
        limit: opts.limit,
        cursor: opts.cursor,
        after: opts.after,
        searchFilter: opts.searchFilter,
      }),
    []
  );

  const yearFetch = useCallback(
    (opts: { limit: number; cursor?: string; after?: string; searchFilter: typeof searchFilter }) =>
      fetchYearSeries({
        limit: opts.limit,
        cursor: opts.cursor,
        after: opts.after,
        searchFilter: opts.searchFilter,
      }),
    []
  );

  const monthSeries = useStatsSeriesScroll({
    enabled: mode === 'month',
    defaultLimit: STATS_SERIES_CONFIG.month.limit,
    pointWidth: STATS_SERIES_CONFIG.month.pointWidth,
    getPointWidth: options?.getPointWidth,
    autoFillViewport: options?.autoFillViewport,
    searchFilter,
    fetchPage: monthFetch,
    getItemKey: monthSeriesKey,
    scrollRef,
  });

  const yearSeries = useStatsSeriesScroll({
    enabled: mode === 'year',
    defaultLimit: STATS_SERIES_CONFIG.year.limit,
    pointWidth: STATS_SERIES_CONFIG.year.pointWidth,
    getPointWidth: options?.getPointWidth,
    autoFillViewport: options?.autoFillViewport,
    searchFilter,
    fetchPage: yearFetch,
    getItemKey: yearSeriesKey,
    scrollRef,
  });

  const active = mode === 'month' ? monthSeries : yearSeries;

  useOnLedgerChanged(
    useCallback(
      (detail) => {
        const months = detail?.months;
        if (!months?.length) return;
        if (searchActive) {
          if (mode === 'month') void monthSeries.reload();
          else void yearSeries.reload();
          return;
        }
        if (mode === 'month') {
          void monthSeries.patchMonths(months, fetchMonthSeriesPoint);
        } else {
          void yearSeries.reload();
        }
      },
      [searchActive, mode, monthSeries.patchMonths, monthSeries.reload, yearSeries.reload]
    )
  );

  return {
    mode,
    setMode,
    noteQuery,
    setNoteQuery,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    clearSearch,
    searchActive,
    monthSeries,
    yearSeries,
    active,
  };
}
