'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '@/src/i18n';
import { getScrollY } from '@/lib/scroll';

export type CursorPage<T> = {
  items: T[];
  next_cursor?: string | null;
  has_more: boolean;
};

type UseCursorPaginationOptions<T> = {
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>;
  enabled?: boolean;
  rootMargin?: string;
  gateUntilUserScrolls?: boolean;
  getItemKey?: (item: T) => string | number;
  onError?: (error: unknown) => string;
  onBeforeLoadMore?: () => void;
  onAfterLoadMore?: () => void;
};

export function useCursorPagination<T>({
  fetchPage,
  enabled = true,
  rootMargin = '120px',
  gateUntilUserScrolls = false,
  getItemKey,
  onError = (e) => (e instanceof Error ? e.message : i18n.t('common.loadFailed')),
  onBeforeLoadMore,
  onAfterLoadMore,
}: UseCursorPaginationOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchPageRef = useRef(fetchPage);
  const onErrorRef = useRef(onError);
  const onBeforeLoadMoreRef = useRef(onBeforeLoadMore);
  const onAfterLoadMoreRef = useRef(onAfterLoadMore);
  const hasMoreRef = useRef(hasMore);
  const nextCursorRef = useRef(nextCursor);
  const loadingRef = useRef(loading);
  const loadingMoreRef = useRef(loadingMore);
  const blockAutoPaginationRef = useRef(gateUntilUserScrolls);
  const sentinelWasIntersectingRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const getItemKeyRef = useRef(getItemKey);

  fetchPageRef.current = fetchPage;
  getItemKeyRef.current = getItemKey;
  onErrorRef.current = onError;
  onBeforeLoadMoreRef.current = onBeforeLoadMore;
  onAfterLoadMoreRef.current = onAfterLoadMore;
  hasMoreRef.current = hasMore;
  nextCursorRef.current = nextCursor;
  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;

  const resetGate = useCallback(() => {
    blockAutoPaginationRef.current = gateUntilUserScrolls;
    sentinelWasIntersectingRef.current = false;
  }, [gateUntilUserScrolls]);

  const mergeItems = useCallback((prev: T[], incoming: T[]) => {
    const keyFn = getItemKeyRef.current;
    if (!keyFn) return [...prev, ...incoming];
    const seen = new Set(prev.map(keyFn));
    const merged = [...prev];
    for (const item of incoming) {
      const key = keyFn(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged;
  }, []);

  const applyPage = useCallback((data: CursorPage<T>) => {
    const cursor = data.next_cursor ?? null;
    setItems(data.items);
    setNextCursor(cursor);
    setHasMore(data.has_more);
    nextCursorRef.current = cursor;
    hasMoreRef.current = data.has_more;
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setNextCursor(null);
    setHasMore(false);
    setError('');
    resetGate();
    nextCursorRef.current = null;
    hasMoreRef.current = false;
    loadMoreInFlightRef.current = false;
  }, [resetGate]);

  const setLoadingSync = useCallback((value: boolean) => {
    loadingRef.current = value;
    setLoading(value);
  }, []);

  const loadFirst = useCallback(async () => {
    setLoadingSync(true);
    setError('');
    resetGate();
    try {
      const data = await fetchPageRef.current(null);
      applyPage(data);
    } catch (e) {
      setError(onErrorRef.current(e));
    } finally {
      setLoadingSync(false);
      sentinelWasIntersectingRef.current = false;
      requestAnimationFrame(() => {
        tryLoadMoreAtSentinelRef.current();
      });
    }
  }, [resetGate, applyPage, setLoadingSync]);

  const loadMoreRef = useRef<() => void>(() => {});
  loadMoreRef.current = async () => {
    if (
      !hasMoreRef.current ||
      !nextCursorRef.current ||
      loadingMoreRef.current ||
      loadingRef.current ||
      loadMoreInFlightRef.current
    ) {
      return;
    }
    loadMoreInFlightRef.current = true;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    onBeforeLoadMoreRef.current?.();
    const cursor = nextCursorRef.current;
    try {
      const data = await fetchPageRef.current(cursor);
      if (cursor !== nextCursorRef.current) return;
      setItems((prev) => mergeItems(prev, data.items));
      const next = data.next_cursor ?? null;
      setNextCursor(next);
      setHasMore(data.has_more);
      nextCursorRef.current = next;
      hasMoreRef.current = data.has_more;
    } catch (e) {
      setError(onErrorRef.current(e));
    } finally {
      loadMoreInFlightRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
      onAfterLoadMoreRef.current?.();
    }
  };

  const tryLoadMoreAtSentinelRef = useRef<() => void>(() => {});
  tryLoadMoreAtSentinelRef.current = () => {
    if (
      blockAutoPaginationRef.current ||
      loadingRef.current ||
      loadingMoreRef.current ||
      loadMoreInFlightRef.current ||
      !hasMoreRef.current
    ) {
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight + 120) return;
    void loadMoreRef.current();
  };

  useEffect(() => {
    if (!enabled) return;
    void loadFirst();
  }, [enabled, loadFirst]);

  useEffect(() => {
    if (!gateUntilUserScrolls) return;

    const unlock = () => {
      blockAutoPaginationRef.current = false;
      tryLoadMoreAtSentinelRef.current();
    };

    const onScroll = () => {
      if (getScrollY() > 8) {
        blockAutoPaginationRef.current = false;
        tryLoadMoreAtSentinelRef.current();
      }
    };

    window.addEventListener('wheel', unlock, { passive: true });
    window.addEventListener('touchmove', unlock, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', unlock);
      window.removeEventListener('touchmove', unlock);
      window.removeEventListener('scroll', onScroll);
    };
  }, [gateUntilUserScrolls]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        if (!isIntersecting) {
          sentinelWasIntersectingRef.current = false;
          return;
        }
        if (sentinelWasIntersectingRef.current) return;
        if (
          blockAutoPaginationRef.current ||
          loadingRef.current ||
          loadingMoreRef.current ||
          loadMoreInFlightRef.current
        ) {
          return;
        }
        sentinelWasIntersectingRef.current = true;
        void loadMoreRef.current();
      },
      { rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, rootMargin]);

  return {
    items,
    setItems,
    nextCursor,
    setNextCursor,
    hasMore,
    setHasMore,
    loading,
    setLoading: setLoadingSync,
    loadingMore,
    error,
    setError,
    sentinelRef,
    loadFirst,
    reset,
    applyPage,
    isFullyLoaded: !loading && !loadingMore && !hasMore,
  };
}
