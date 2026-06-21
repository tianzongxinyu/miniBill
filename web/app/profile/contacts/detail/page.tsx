'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { ContactDetailSummaryFilters } from '@/components/contacts/ContactDetailSummaryFilters';
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
  deleteContact,
  fetchContactDetail,
  fetchTransactions,
  type ContactDetail,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { scrollToTop } from '@/lib/scroll';
import {
  buildContactDetailHref,
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
  const backHref = safeReturnTo(returnTo, '/profile/contacts/');
  const contactId = id ? Number(id) : null;
  const [c, setC] = useState<ContactDetail | null>(null);
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
    fetchContactDetail(Number(id))
      .then(setC)
      .catch((e) => setError(formatApiError(e, t('common.loadFailed'))));
  }, [id, t]);

  const filtersRef = useRef({ contactId, typeFilter });
  filtersRef.current = { contactId, typeFilter };
  const reloadAbortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async (cursor: string | null, signal?: AbortSignal) => {
    const f = filtersRef.current;
    return fetchTransactions({
      contactId: f.contactId!,
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
    if (contactId == null) return;
    void reload();
  }, [contactId, typeFilter, reload]);

  const handleTypeFilterChange = useCallback(
    (type: 'expense' | 'income') => {
      const next: TransactionTypeFilter = typeFilter === type ? null : type;
      setTypeFilter(next);
      scrollToTop(false);
      router.replace(
        buildContactDetailHref({
          contactId: contactId!,
          returnTo: returnTo ?? undefined,
          type: next ?? undefined,
        })
      );
    },
    [typeFilter, contactId, returnTo, router]
  );

  const animateIds = useLoadMoreAnimateIds(
    list.items,
    list.loading,
    list.loadingMore,
    (tx) => tx.id
  );

  const unused = c != null && !c.last_transaction;

  const emptyMessage = useMemo(() => {
    if (typeFilter === 'expense') return t('contacts.emptySent');
    if (typeFilter === 'income') return t('contacts.emptyReceived');
    return t('transactions.empty');
  }, [typeFilter, t]);

  const confirmRemove = async () => {
    if (!c || !id || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteContact(Number(id));
      router.replace('/profile/contacts/');
    } catch (err) {
      setError(formatApiError(err, t('common.deleteFailed')));
      setConfirmOpen(false);
      setDeleting(false);
    }
  };

  if (!c) return <LoadingFallback />;

  const statGrid = 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center';
  const amountSlot = 'min-w-[6.5rem] text-right shrink-0';

  return (
    <div>
      <div className={`${statGrid} mb-4 items-baseline`}>
        <p className="text-base font-semibold text-ink min-w-0 px-4 truncate">{c.name}</p>
        <div className="w-px mx-2 sm:mx-2.5 shrink-0" aria-hidden />
        <div className="flex items-baseline justify-end min-w-0 pl-3 pr-4 text-sm">
          <span className={amountSlot}>
            <SignedAmount cents={c.net_amount} className="text-sm" />
          </span>
        </div>
      </div>
      <div className="mb-4">
        <ContactDetailSummaryFilters
          sentCents={c.social_expense}
          receivedCents={c.social_income}
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
          {t('contacts.deleteContact')}
        </button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={t('contacts.deleteTitle')}
        message={t('contacts.deleteMessage', { name: c.name })}
        confirmLabel={t('common.delete')}
        confirming={deleting}
        onConfirm={() => void confirmRemove()}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
      />
      <PageBackLink href={backHref} />
    </div>
  );
}

export default function ContactDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <DetailInner />
      </Suspense>
    </RequireAuth>
  );
}
