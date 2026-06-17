'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { Amount } from '@/components/ui/Amount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { ListSkeleton, LoadingFallback } from '@/components/ui/LoadingFallback';
import { Notebook } from '@/components/ui/Notebook';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import { useLoadMoreAnimateIds } from '@/hooks/useLoadMoreAnimateIds';
import { deleteContact, fetchContactDetail, fetchTransactions, type ContactDetail } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { safeReturnTo } from '@/lib/url';

function DetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const returnTo = params.get('returnTo');
  const backHref = safeReturnTo(returnTo, '/profile/contacts/');
  const contactId = id ? Number(id) : null;
  const [c, setC] = useState<ContactDetail | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchContactDetail(Number(id))
      .then(setC)
      .catch((e) => setError(formatApiError(e, '加载失败')));
  }, [id]);

  const fetchPage = useCallback(
    (cursor: string | null) =>
      fetchTransactions({ contactId: contactId!, cursor, limit: 10 }),
    [contactId]
  );

  const list = useCursorPagination({
    enabled: contactId != null,
    fetchPage,
    getItemKey: (tx) => tx.id,
    onError: (e) => formatApiError(e, '加载失败'),
  });

  const animateIds = useLoadMoreAnimateIds(
    list.items,
    list.loading,
    list.loadingMore,
    (tx) => tx.id
  );

  const unused = c != null && !c.last_transaction;

  const confirmRemove = async () => {
    if (!c || !id || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteContact(Number(id));
      router.replace('/profile/contacts/');
    } catch (err) {
      setError(formatApiError(err, '删除失败'));
      setConfirmOpen(false);
      setDeleting(false);
    }
  };

  if (!c) return <LoadingFallback />;

  const stats = [
    { label: '送出', value: <Amount cents={c.social_expense} type="expense" className="text-sm" /> },
    { label: '收到', value: <Amount cents={c.social_income} type="income" className="text-sm" /> },
  ];

  const statGrid = 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center';
  const amountSlot = 'min-w-[6.5rem] text-right shrink-0';

  return (
    <div>
      <div className={`${statGrid} mb-4 items-baseline`}>
        <h1 className="page-title min-w-0 px-4">{c.name}</h1>
        <div className="w-px mx-2 sm:mx-2.5 shrink-0" aria-hidden />
        <div className="flex items-baseline justify-end min-w-0 pl-3 pr-4 text-sm">
          <span className={amountSlot}>
            <SignedAmount cents={c.net_amount} className="text-sm" />
          </span>
        </div>
      </div>
      <div className={`notebook mb-4 ${statGrid} py-2`}>
        <div className="flex items-baseline justify-between gap-2 min-w-0 pl-4 pr-3">
          <span className="stat-label shrink-0">{stats[0].label}</span>
          <span className={amountSlot}>{stats[0].value}</span>
        </div>
        <div className="w-px h-8 bg-line/80 mx-2 self-center shrink-0" aria-hidden />
        <div className="flex items-baseline justify-between gap-2 min-w-0 pl-3 pr-4">
          <span className="stat-label shrink-0">{stats[1].label}</span>
          <span className={amountSlot}>{stats[1].value}</span>
        </div>
      </div>

      {list.loading ? (
        <ListSkeleton />
      ) : list.items.length === 0 ? (
        <EmptyNotebook message="暂无流水" />
      ) : (
        <Notebook>
          {list.items.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} animate={animateIds.has(tx.id)} />
          ))}
        </Notebook>
      )}
      <div ref={list.sentinelRef} className="h-4" aria-hidden />
      {list.loadingMore && <p className="text-center text-sm text-muted py-2">加载中…</p>}
      {!list.loading && !list.hasMore && list.items.length > 0 && (
        <p className="text-center text-sm text-muted py-2">已到底</p>
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
          删除联系人
        </button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="删除联系人"
        message={`确定删除联系人「${c.name}」？`}
        confirmLabel="删除"
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
