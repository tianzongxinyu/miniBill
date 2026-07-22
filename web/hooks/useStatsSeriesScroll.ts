'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { StatsSearchFilter, StatsSeriesPage } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { maxScrollLeft } from '@/lib/statsChartScrollSync';
import i18n from '@/src/i18n';

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
  getPointWidth?: () => number;
  autoFillViewport?: boolean;
  searchFilter: StatsSearchFilter;
  fetchPage: (opts: SeriesFetchOpts) => Promise<StatsSeriesPage<T>>;
  getItemKey: (item: T) => string;
  scrollRef?: RefObject<HTMLDivElement | null>;
};

export function useStatsSeriesScroll<T>({
  enabled,
  defaultLimit,
  pointWidth,
  getPointWidth,
  autoFillViewport = true,
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
  const [error, setError] = useState<string | null>(null);

  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const fetchPageRef = useRef(fetchPage);
  const loadingOlderRef = useRef(false);
  const loadingNewerRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);
  const shouldScrollEndRef = useRef(false);
  const prependWidthRef = useRef(0);
  const getPointWidthRef = useRef(getPointWidth);
  const generationRef = useRef(0);
  const searchFilterRef = useRef(searchFilter);
  getPointWidthRef.current = getPointWidth;
  searchFilterRef.current = searchFilter;

  const resolvePointWidth = useCallback(() => {
    return getPointWidthRef.current?.() ?? pointWidth;
  }, [pointWidth]);

  fetchPageRef.current = fetchPage;

  const clearError = useCallback(() => setError(null), []);

  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const apply = () => {
      el.scrollLeft = maxScrollLeft(el.scrollWidth, el.clientWidth);
    };

    const tryScroll = (attemptsLeft: number) => {
      requestAnimationFrame(() => {
        apply();
        if (el.scrollLeft > 0 || el.scrollWidth <= el.clientWidth + 1) return;
        if (attemptsLeft > 0) tryScroll(attemptsLeft - 1);
      });
    };

    requestAnimationFrame(() => tryScroll(3));
  }, [scrollRef]);

  const loadInitial = useCallback(async () => {
    const generation = ++generationRef.current;
    loadingOlderRef.current = false;
    loadingNewerRef.current = false;
    setLoadingOlder(false);
    setLoadingNewer(false);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPageRef.current({
        limit: defaultLimit,
        searchFilter: searchFilterRef.current,
      });
      if (generation !== generationRef.current) return;
      setItems(data.items);
      setHasMoreOlder(data.has_more_older);
      setHasMoreNewer(data.has_more_newer);
      shouldScrollEndRef.current = true;
      setError(null);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(formatApiError(e, i18n.t('common.loadFailed')));
      // Keep previous items on reload failure so the chart does not blank out.
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [defaultLimit]);

  useEffect(() => {
    if (!enabled) {
      generationRef.current += 1;
      setItems([]);
      setHasMoreOlder(false);
      setHasMoreNewer(false);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadInitial();
  }, [enabled, searchFilter, loadInitial]);

  useEffect(() => {
    if (!shouldScrollEndRef.current) return;
    shouldScrollEndRef.current = false;

    const el = scrollRef.current;
    if (!el) {
      scrollToEnd();
      return;
    }

    scrollToEnd();

    let observer: ResizeObserver | null = null;
    if (el.scrollWidth <= el.clientWidth + 1) {
      observer = new ResizeObserver(() => {
        el.scrollLeft = maxScrollLeft(el.scrollWidth, el.clientWidth);
        if (el.scrollWidth > el.clientWidth + 1) observer?.disconnect();
      });
      observer.observe(el);
    }

    return () => observer?.disconnect();
  }, [items, scrollToEnd, scrollRef]);

  const loadOlder = useCallback(async () => {
    if (!enabled || loadingOlderRef.current || !hasMoreOlder || items.length === 0) return;
    const generation = generationRef.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const cursor = getItemKey(items[0]);
      const data = await fetchPageRef.current({
        limit: defaultLimit,
        cursor,
        searchFilter: searchFilterRef.current,
      });
      if (generation !== generationRef.current) return;
      if (data.items.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      prependWidthRef.current = data.items.length * resolvePointWidth();
      setItems((prev) => [...data.items, ...prev]);
      setHasMoreOlder(data.has_more_older);
      setError(null);
      requestAnimationFrame(() => {
        if (generation !== generationRef.current) return;
        const el = scrollRef.current;
        if (el) el.scrollLeft += prependWidthRef.current;
      });
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(formatApiError(e, i18n.t('common.loadFailed')));
    } finally {
      if (generation === generationRef.current) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      } else {
        loadingOlderRef.current = false;
      }
    }
  }, [enabled, hasMoreOlder, items, defaultLimit, getItemKey, resolvePointWidth, scrollRef]);

  const loadNewer = useCallback(async () => {
    if (!enabled || loadingNewerRef.current || !hasMoreNewer || items.length === 0) return;
    const generation = generationRef.current;
    loadingNewerRef.current = true;
    setLoadingNewer(true);
    try {
      const after = getItemKey(items[items.length - 1]);
      const data = await fetchPageRef.current({
        limit: defaultLimit,
        after,
        searchFilter: searchFilterRef.current,
      });
      if (generation !== generationRef.current) return;
      if (data.items.length === 0) {
        setHasMoreNewer(false);
        return;
      }
      setItems((prev) => [...prev, ...data.items]);
      setHasMoreNewer(data.has_more_newer);
      setError(null);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(formatApiError(e, i18n.t('common.loadFailed')));
    } finally {
      if (generation === generationRef.current) {
        loadingNewerRef.current = false;
        setLoadingNewer(false);
      } else {
        loadingNewerRef.current = false;
      }
    }
  }, [enabled, hasMoreNewer, items, defaultLimit, getItemKey]);

  // Wide viewports may fit all loaded points — keep fetching until the chart overflows or data ends.
  useEffect(() => {
    if (!autoFillViewport || !enabled || loading || loadingOlderRef.current || loadingNewerRef.current) return;
    if (!hasMoreOlder && !hasMoreNewer) return;

    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || el.clientWidth === 0) return;
      if (el.scrollWidth > el.clientWidth + 1) return;
      if (hasMoreOlder) void loadOlder();
      else if (hasMoreNewer) void loadNewer();
    });

    return () => cancelAnimationFrame(raf);
  }, [autoFillViewport, enabled, loading, hasMoreOlder, hasMoreNewer, items, loadOlder, loadNewer, scrollRef]);

  useEffect(() => {
    if (!autoFillViewport || !enabled) return;

    let el = scrollRef.current;
    let raf = 0;
    let boundEl: HTMLDivElement | null = null;
    let observer: ResizeObserver | null = null;

    const checkOverflow = () => {
      const target = scrollRef.current;
      if (!target || loading || loadingOlderRef.current || loadingNewerRef.current) return;
      if (!hasMoreOlder && !hasMoreNewer) return;
      if (target.clientWidth === 0) return;
      if (target.scrollWidth > target.clientWidth + 1) return;
      if (hasMoreOlder) void loadOlder();
      else if (hasMoreNewer) void loadNewer();
    };

    const bind = () => {
      el = scrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      if (boundEl === el) return;
      observer?.disconnect();
      observer = new ResizeObserver(() => requestAnimationFrame(checkOverflow));
      observer.observe(el);
      boundEl = el;
      requestAnimationFrame(checkOverflow);
    };

    bind();

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [autoFillViewport, enabled, loading, hasMoreOlder, hasMoreNewer, loadOlder, loadNewer, scrollRef, items]);

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
      const generation = generationRef.current;
      const updates = await Promise.all(
        months.map(({ year, month }) => resolve(year, month))
      );
      if (generation !== generationRef.current) return;
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
    error,
    clearError,
    scrollRef,
    onScroll,
    pointWidth,
    reload: loadInitial,
    patchMonths,
  };
}
