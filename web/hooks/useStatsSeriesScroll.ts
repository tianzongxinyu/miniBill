'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { StatsSearchFilter, StatsSeriesPage } from '@/lib/api';

type SeriesFetchOpts = {
  limit: number;
  cursor?: string;
  after?: string;
  searchFilter: StatsSearchFilter;
};

type UseStatsSeriesScrollOptions<T> = {
  enabled: boolean;
  defaultLimit: number;
  pointWidth: number;
  searchFilter: StatsSearchFilter;
  fetchPage: (opts: SeriesFetchOpts) => Promise<StatsSeriesPage<T>>;
  getItemKey: (item: T) => string;
  scrollRef?: RefObject<HTMLDivElement | null>;
};

export function useStatsSeriesScroll<T>({
  enabled,
  defaultLimit,
  pointWidth,
  searchFilter,
  fetchPage,
  getItemKey,
  scrollRef: externalScrollRef,
}: UseStatsSeriesScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);

  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const fetchPageRef = useRef(fetchPage);
  const loadingOlderRef = useRef(false);
  const loadingNewerRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const shouldScrollEndRef = useRef(false);
  const prependWidthRef = useRef(0);

  fetchPageRef.current = fetchPage;

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [scrollRef]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPageRef.current({ limit: defaultLimit, searchFilter });
      setItems(data.items);
      setHasMoreOlder(data.has_more_older);
      setHasMoreNewer(data.has_more_newer);
      shouldScrollEndRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [defaultLimit, searchFilter]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setHasMoreOlder(false);
      setHasMoreNewer(false);
      return;
    }
    loadInitial();
  }, [enabled, loadInitial]);

  useEffect(() => {
    if (!shouldScrollEndRef.current) return;
    shouldScrollEndRef.current = false;
    requestAnimationFrame(scrollToEnd);
  }, [items, scrollToEnd]);

  const loadOlder = useCallback(async () => {
    if (!enabled || loadingOlderRef.current || !hasMoreOlder || items.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const cursor = getItemKey(items[0]);
      const data = await fetchPageRef.current({ limit: defaultLimit, cursor, searchFilter });
      if (data.items.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      prependWidthRef.current = data.items.length * pointWidth;
      setItems((prev) => [...data.items, ...prev]);
      setHasMoreOlder(data.has_more_older);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft += prependWidthRef.current;
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [enabled, hasMoreOlder, items, defaultLimit, searchFilter, getItemKey, pointWidth, scrollRef]);

  const loadNewer = useCallback(async () => {
    if (!enabled || loadingNewerRef.current || !hasMoreNewer || items.length === 0) return;
    loadingNewerRef.current = true;
    setLoadingNewer(true);
    try {
      const after = getItemKey(items[items.length - 1]);
      const data = await fetchPageRef.current({ limit: defaultLimit, after, searchFilter });
      if (data.items.length === 0) {
        setHasMoreNewer(false);
        return;
      }
      setItems((prev) => [...prev, ...data.items]);
      setHasMoreNewer(data.has_more_newer);
    } finally {
      loadingNewerRef.current = false;
      setLoadingNewer(false);
    }
  }, [enabled, hasMoreNewer, items, defaultLimit, searchFilter, getItemKey]);

  // Wide viewports may fit all loaded points — keep fetching until the chart overflows or data ends.
  useEffect(() => {
    if (!enabled || loading || loadingOlderRef.current || loadingNewerRef.current) return;
    if (!hasMoreOlder && !hasMoreNewer) return;

    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || el.scrollWidth > el.clientWidth + 1) return;
      if (hasMoreOlder) void loadOlder();
      else if (hasMoreNewer) void loadNewer();
    });

    return () => cancelAnimationFrame(raf);
  }, [enabled, loading, hasMoreOlder, hasMoreNewer, items, loadOlder, loadNewer, scrollRef]);

  const onScroll = useCallback(() => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollRef.current;
      if (!el || loading) return;
      if (el.scrollLeft < 40) loadOlder();
      if (el.scrollLeft + el.clientWidth > el.scrollWidth - 40) loadNewer();
    });
  }, [loadOlder, loadNewer, loading, scrollRef]);

  const patchMonths = useCallback(
    async (
      months: Array<{ year: number; month: number }>,
      resolve: (year: number, month: number) => Promise<T | null>
    ) => {
      if (!enabled || months.length === 0) return;
      const updates = await Promise.all(
        months.map(({ year, month }) => resolve(year, month))
      );
      setItems((prev) => {
        const next = [...prev];
        for (const item of updates) {
          if (!item) continue;
          const key = getItemKey(item);
          const idx = next.findIndex((x) => getItemKey(x) === key);
          if (idx >= 0) next[idx] = item;
        }
        return next;
      });
    },
    [enabled, getItemKey]
  );

  return {
    items,
    loading,
    loadingOlder,
    loadingNewer,
    hasMoreOlder,
    hasMoreNewer,
    scrollRef,
    onScroll,
    pointWidth,
    reload: loadInitial,
    patchMonths,
  };
}
