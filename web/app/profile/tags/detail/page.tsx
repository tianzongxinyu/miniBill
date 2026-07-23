'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { TagDetailSummaryFilters } from '@/components/tags/TagDetailSummaryFilters';
import { PageBackLink } from '@/components/ui/BackLink';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { ListSkeleton, LoadingFallback } from '@/components/ui/LoadingFallback';
import { Notebook } from '@/components/ui/Notebook';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import { useLoadMoreAnimateIds } from '@/hooks/useLoadMoreAnimateIds';
import {
  ApiError,
  deleteTag,
  fetchTagDetail,
  fetchTransactions,
  type TagDetail,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { scrollToTop } from '@/lib/scroll';
import {
  buildTagDetailHref,
  parseTransactionTypeFromQuery,
  safeReturnTo,
  type TransactionTypeFilter,
} from '@/lib/url';

function DetailInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const returnTo = params.get('returnTo');
  const urlType = params.get('type');
  const backHref = safeReturnTo(returnTo, '/profile/tags/');
  const tagId = id ? Number(id) : null;
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>(() =>
    parseTransactionTypeFromQuery(params)
  );

  useEffect(() => {
    setTypeFilter(parseTransactionTypeFromQuery(params));
  }, [urlType, params]);

  useEffect(() => {
    if (!id) return;
    fetchTagDetail(Number(id))
      .then(setTag)
      .catch((e) => setError(formatApiError(e, t('common.loadFailed'))));
  }, [id, t]);

  const filtersRef = useRef({ tagId, typeFilter });
  filtersRef.current = { tagId, typeFilter };
  const reloadAbortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async (cursor: string | null, signal?: AbortSignal) => {
    const f = filtersRef.current;
    return fetchTransactions({
      tagIds: [f.tagId!],
      cursor,
      limit: 10,
      ...(f.typeFilter ? { type: f.typeFilter } : {}),
      signal,
    });
  }, []);

  const fetchPage = useCallback(
    (cursor: string | null) => fetchOnce(cursor),
    [fetchOnce]
  );

  const list = useCursorPagination({
    enabled: false,
    fetchPage,
    getItemKey: (tx) => tx.id,
    onError: (e) => formatApiError(e, t('common.loadFailed')),
  });

  const { reset, applyPage, setLoading, setError: setListError } = list;

  const reload = useCallback(async () => {
    reloadAbortRef.current?.abort();
    const ac = new AbortController();
    reloadAbortRef.current = ac;

    reset();
    setLoading(true);
    setListError('');
    try {
      const data = await fetchOnce(null, ac.signal);
      if (reloadAbortRef.current !== ac) return;
      applyPage(data);
    } catch (e) {
      if (reloadAbortRef.current !== ac) return;
      if (e instanceof ApiError && e.code === 'ABORTED') return;
      setListError(formatApiError(e, t('common.loadFailed')));
    } finally {
      if (reloadAbortRef.current === ac) {
        setLoading(false);
      }
    }
  }, [reset, applyPage, setLoading, setListError, fetchOnce, t]);

  useEffect(() => {
    if (tagId == null) return;
    void reload();
  }, [tagId, typeFilter, reload]);

  const handleTypeFilterChange = useCallback(
    (type: 'expense' | 'income') => {
      const next: TransactionTypeFilter = typeFilter === type ? null : type;
      setTypeFilter(next);
      scrollToTop(false);
      router.replace(
        buildTagDetailHref({
          tagId: tagId!,
          returnTo: returnTo ?? undefined,
          type: next ?? undefined,
        })
      );
    },
    [typeFilter, tagId, returnTo, router]
  );

  const animateIds = useLoadMoreAnimateIds(
    list.items,
    list.loading,
    list.loadingMore,
    (tx) => tx.id
  );

  const unused = tag != null && !tag.last_transaction && !tag.is_system;

  const emptyMessage = useMemo(() => {
    if (typeFilter === 'expense') return t('tags.emptyExpense');
    if (typeFilter === 'income') return t('tags.emptyIncome');
    return t('transactions.empty');
  }, [typeFilter, t]);

  const confirmRemove = async () => {
    if (!tag || !id || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteTag(Number(id));
      router.replace('/profile/tags/');
    } catch (err) {
      setError(formatApiError(err, t('common.deleteFailed')));
      setConfirmOpen(false);
      setDeleting(false);
    }
  };

  if (!tag) return <LoadingFallback />;

  const statGrid = 'grid grid-cols-2 items-center';
  const amountSlot = 'min-w-[6.5rem] text-right shrink-0';

  return (
    <div className="page-detail-with-floating-back">
      <div className={`${statGrid} mb-2 items-baseline`}>
        <p
          className={`text-base font-semibold text-ink min-w-0 px-4 truncate ${
            !tag.enabled ? 'opacity-45' : ''
          }`}
        >
          {tag.name}
          {tag.is_system ? <span className="text-muted text-xs font-normal"> *</span> : null}
        </p>
        <div className="flex items-baseline justify-end min-w-0 pl-3 pr-4 text-sm">
          <span className={amountSlot}>
            <SignedAmount cents={tag.net_amount} className="text-sm" />
          </span>
        </div>
      </div>
      <div className="mb-2">
        <TagDetailSummaryFilters
          expenseCents={tag.total_expense}
          incomeCents={tag.total_income}
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
        />
      </div>

      {list.loading ? (
        <ListSkeleton />
      ) : list.items.length === 0 ? (
        <EmptyNotebook message={emptyMessage} />
      ) : (
        <Notebook>
          {list.items.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} animate={animateIds.has(tx.id)} />
          ))}
        </Notebook>
      )}
      <div ref={list.sentinelRef} className="h-4" aria-hidden />
      {list.loadingMore && <p className="text-center text-sm text-muted py-2">{t('common.loading')}</p>}
      {!list.loading && !list.hasMore && list.items.length > 0 && (
        <p className="text-center text-sm text-muted py-2">{t('common.endOfList')}</p>
      )}
      {list.error && <p className="text-expense text-sm mt-2">{list.error}</p>}

      {error && <p className="text-expense text-sm mt-4">{error}</p>}
      {unused && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={deleting}
          className="btn-ghost px-0 text-expense text-sm mt-6"
        >
          {t('tags.deleteTagButton')}
        </button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={t('tags.deleteTitle')}
        message={t('tags.deleteMessage', { name: tag.name })}
        confirmLabel={t('common.delete')}
        confirming={deleting}
        onConfirm={() => void confirmRemove()}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
      />
      <PageBackLink href={backHref} floating />
    </div>
  );
}

export default function TagDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <DetailInner />
      </Suspense>
    </RequireAuth>
  );
}
