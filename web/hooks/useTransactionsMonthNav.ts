'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { compareYearMonth, prevMonth, type YearMonth } from '@/lib/api';
import { isNearPageBottom } from '@/lib/scroll';

type UseTransactionsMonthNavOptions = {
  year: number;
  month: number;
  monthFullyLoaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  earliest: YearMonth | null;
  enabled?: boolean;
};

export function useTransactionsMonthNav({
  year,
  month,
  monthFullyLoaded,
  loading,
  loadingMore,
  hasMore,
  earliest,
  enabled = true,
}: UseTransactionsMonthNavOptions) {
  const [atBottom, setAtBottom] = useState(false);

  const monthFullyLoadedRef = useRef(monthFullyLoaded);
  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  const hasMoreRef = useRef(hasMore);

  monthFullyLoadedRef.current = monthFullyLoaded;
  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;
  hasMoreRef.current = hasMore;

  const resetAll = useCallback(() => {
    setAtBottom(false);
  }, []);

  const markLoadSettling = useCallback(() => {
    setAtBottom(false);
  }, []);

  const canGoPrevMonth = useCallback(() => {
    if (!earliest) return true;
    return compareYearMonth(prevMonth(year, month), earliest) >= 0;
  }, [earliest, year, month]);

  useEffect(() => {
    if (!enabled) return;

    const syncAtBottom = () => {
      if (
        !monthFullyLoadedRef.current ||
        loadingRef.current ||
        loadingMoreRef.current ||
        hasMoreRef.current
      ) {
        setAtBottom(false);
        return;
      }
      setAtBottom(isNearPageBottom());
    };

    window.addEventListener('scroll', syncAtBottom, { passive: true });
    const main = document.querySelector('main');
    main?.addEventListener('scroll', syncAtBottom, { passive: true });
    syncAtBottom();

    return () => {
      window.removeEventListener('scroll', syncAtBottom);
      main?.removeEventListener('scroll', syncAtBottom);
    };
  }, [enabled, year, month, monthFullyLoaded, loading, loadingMore, hasMore]);

  return {
    atBottom,
    canGoPrevMonth: canGoPrevMonth(),
    markLoadSettling,
    resetAll,
  };
}
