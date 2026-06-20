'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  fetchTransactions,
  type Transaction,
  type TransactionsPage,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { scrollToTop, pullTransactionsScroll, scrollToY, currentPathWithSearch } from '@/lib/scroll';
import { useOnLedgerChanged, monthInDetail } from '@/lib/ledgerEvents';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import type { TransactionTypeFilter } from '@/lib/url';

function monthKey(y: number, m: number) {
  return `${y}-${m}`;
}

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
  const monthInflightRef = useRef<Map<string, Promise<TransactionsPage>>>(new Map());
  const reloadAbortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef({ year, month, note, tagIds, contactId, searchActive, typeFilter });
  filtersRef.current = { year, month, note, tagIds, contactId, searchActive, typeFilter };

  const fetchOnce = useCallback(async (cursor: string | null, signal?: AbortSignal) => {
    const f = filtersRef.current;
    const typeKey = !f.searchActive && f.typeFilter ? f.typeFilter : '';
    const key =
      (f.searchActive ? 'search' : monthKey(f.year, f.month)) +
      `|${typeKey}|${f.note}|${f.tagIds.join(',')}|${f.contactId ?? ''}|${cursor ?? ''}`;
    const inflight = monthInflightRef.current;

    // 首屏 reload 带 AbortSignal，不能与进行中的去重请求共用 Promise；
    // 仅 loadMore（cursor 非空且无 signal）才走 inflight 去重。
    const canDedupe = cursor != null && signal == null;
    if (canDedupe) {
      const pending = inflight.get(key);
      if (pending) return pending;
    }

    const pending = fetchTransactions({
      ...(f.searchActive
        ? { note: f.note, tagIds: f.tagIds, contactId: f.contactId }
        : {
            year: f.year,
            month: f.month,
            ...(f.typeFilter ? { type: f.typeFilter } : {}),
          }),
      cursor: cursor ?? undefined,
      limit: 10,
      signal,
    }).finally(() => {
      inflight.delete(key);
    });
    if (canDedupe) {
      inflight.set(key, pending);
    }
    return pending;
  }, []);

  const pagination = useCursorPagination<Transaction>({
    fetchPage: (cursor) => fetchOnce(cursor),
    enabled: false,
    gateUntilUserScrolls: true,
    getItemKey: (tx) => tx.id,
    onError: (e) => formatApiError(e, t('common.loadFailed')),
  });

  const { reset, applyPage, setLoading, setError } = pagination;

  const reload = useCallback(async () => {
    reloadAbortRef.current?.abort();
    const ac = new AbortController();
    reloadAbortRef.current = ac;

    reset();
    setLoading(true);
    setError('');
    try {
      const data = await fetchOnce(null, ac.signal);
      if (reloadAbortRef.current !== ac) return;
      applyPage(data);
      const href = currentPathWithSearch();
      const restored = pullTransactionsScroll(href);
      if (restored != null) {
        requestAnimationFrame(() => scrollToY(restored));
      } else {
        scrollToTop(false);
      }
    } catch (e) {
      if (reloadAbortRef.current !== ac) return;
      if (e instanceof ApiError && e.code === 'ABORTED') return;
      setError(formatApiError(e, t('common.loadFailed')));
    } finally {
      if (reloadAbortRef.current === ac) {
        setLoading(false);
      }
    }
  }, [reset, applyPage, setLoading, setError, fetchOnce, year, month, note, tagIds, contactId, searchActive, typeFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useOnLedgerChanged(
    useCallback(
      (detail) => {
        const f = filtersRef.current;
        if (f.searchActive) return;
        if (!monthInDetail(detail, f.year, f.month)) return;
        void reload();
      },
      [reload]
    )
  );

  return {
    ...pagination,
    reload,
  };
}
