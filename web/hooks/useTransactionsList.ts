'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  fetchTransactions,
  TRANSACTIONS_MONTH_LIMIT,
  TRANSACTIONS_SEARCH_PAGE_SIZE,
  type Transaction,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { scrollToTop, pullTransactionsScroll, scrollToY, currentPathWithSearch } from '@/lib/scroll';
import { useOnLedgerChanged, monthInDetail } from '@/lib/ledgerEvents';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import type { TransactionTypeFilter } from '@/lib/url';

type UseTransactionsListOptions = {
  year: number;
  month: number;
  note: string;
  tagIds: number[];
  contactId: number | null;
  searchActive: boolean;
  typeFilter: TransactionTypeFilter;
};

export function useTransactionsList({
  year,
  month,
  note,
  tagIds,
  contactId,
  searchActive,
  typeFilter,
}: UseTransactionsListOptions) {
  const { t } = useTranslation();
  const filtersRef = useRef({ year, month, note, tagIds, contactId, searchActive, typeFilter });
  filtersRef.current = { year, month, note, tagIds, contactId, searchActive, typeFilter };

  const [monthItems, setMonthItems] = useState<Transaction[]>([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState('');
  const monthReloadAbortRef = useRef<AbortController | null>(null);
  const searchReloadAbortRef = useRef<AbortController | null>(null);
  const searchInflightRef = useRef<Map<string, Promise<Awaited<ReturnType<typeof fetchTransactions>>>>>(
    new Map()
  );

  const fetchSearchPage = useCallback(async (cursor: string | null, signal?: AbortSignal) => {
    const f = filtersRef.current;
    const key = `search|${f.note}|${f.tagIds.join(',')}|${f.contactId ?? ''}|${cursor ?? ''}`;
    const inflight = searchInflightRef.current;

    const canDedupe = cursor != null && signal == null;
    if (canDedupe) {
      const pending = inflight.get(key);
      if (pending) return pending;
    }

    const pending = fetchTransactions({
      note: f.note,
      tagIds: f.tagIds,
      contactId: f.contactId,
      cursor: cursor ?? undefined,
      limit: TRANSACTIONS_SEARCH_PAGE_SIZE,
      signal,
    }).finally(() => {
      inflight.delete(key);
    });
    if (canDedupe) {
      inflight.set(key, pending);
    }
    return pending;
  }, []);

  const searchPagination = useCursorPagination<Transaction>({
    fetchPage: (cursor) => fetchSearchPage(cursor),
    enabled: false,
    gateUntilUserScrolls: true,
    getItemKey: (tx) => tx.id,
    onError: (e) => formatApiError(e, t('common.loadFailed')),
  });

  const { reset: resetSearch, applyPage, setLoading: setSearchLoading, setError: setSearchError } =
    searchPagination;

  const restoreScrollOrTop = useCallback(() => {
    const href = currentPathWithSearch();
    const restored = pullTransactionsScroll(href);
    if (restored != null) {
      requestAnimationFrame(() => scrollToY(restored));
    } else {
      scrollToTop(false);
    }
  }, []);

  const reloadMonth = useCallback(async () => {
    monthReloadAbortRef.current?.abort();
    const ac = new AbortController();
    monthReloadAbortRef.current = ac;

    setMonthItems([]);
    setMonthLoading(true);
    setMonthError('');

    const f = filtersRef.current;
    try {
      const data = await fetchTransactions({
        year: f.year,
        month: f.month,
        ...(f.typeFilter ? { type: f.typeFilter } : {}),
        limit: TRANSACTIONS_MONTH_LIMIT,
        signal: ac.signal,
      });
      if (monthReloadAbortRef.current !== ac) return;
      setMonthItems(data.items);
      restoreScrollOrTop();
    } catch (e) {
      if (monthReloadAbortRef.current !== ac) return;
      if (e instanceof ApiError && e.code === 'ABORTED') return;
      setMonthError(formatApiError(e, t('common.loadFailed')));
    } finally {
      if (monthReloadAbortRef.current === ac) {
        setMonthLoading(false);
      }
    }
  }, [restoreScrollOrTop, t, year, month, typeFilter]);

  const reloadSearch = useCallback(async () => {
    searchReloadAbortRef.current?.abort();
    const ac = new AbortController();
    searchReloadAbortRef.current = ac;

    resetSearch();
    setSearchLoading(true);
    setSearchError('');
    try {
      const data = await fetchSearchPage(null, ac.signal);
      if (searchReloadAbortRef.current !== ac) return;
      applyPage(data);
      restoreScrollOrTop();
    } catch (e) {
      if (searchReloadAbortRef.current !== ac) return;
      if (e instanceof ApiError && e.code === 'ABORTED') return;
      setSearchError(formatApiError(e, t('common.loadFailed')));
    } finally {
      if (searchReloadAbortRef.current === ac) {
        setSearchLoading(false);
      }
    }
  }, [
    resetSearch,
    applyPage,
    setSearchLoading,
    setSearchError,
    fetchSearchPage,
    restoreScrollOrTop,
    t,
    note,
    tagIds,
    contactId,
  ]);

  useEffect(() => {
    if (searchActive) {
      void reloadSearch();
    } else {
      void reloadMonth();
    }
  }, [searchActive, reloadSearch, reloadMonth]);

  useOnLedgerChanged(
    useCallback(
      (detail) => {
        const f = filtersRef.current;
        if (f.searchActive) return;
        if (!monthInDetail(detail, f.year, f.month)) return;
        void reloadMonth();
      },
      [reloadMonth]
    )
  );

  if (searchActive) {
    return {
      ...searchPagination,
      reload: reloadSearch,
    };
  }

  return {
    items: monthItems,
    loading: monthLoading,
    loadingMore: false,
    hasMore: false,
    error: monthError,
    isFullyLoaded: !monthLoading,
    sentinelRef: searchPagination.sentinelRef,
    reload: reloadMonth,
  };
}
