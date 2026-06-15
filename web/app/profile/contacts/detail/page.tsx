'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
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

function DetailInner() {
  const router = useRouter();
  const id = useSearchParams().get('id');
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
    { label: '送出', value: <Amount cents={c.social_expense} type="expense" className="text-base" /> },
    { label: '收到', value: <Amount cents={c.social_income} type="income" className="text-base" /> },
    { label: '净额', value: <SignedAmount cents={c.net_amount} className="text-base" /> },
  ];

  return (
    <div>
      <BackLink href="/profile/contacts/">联系人</BackLink>
      <PageHeader title={c.name} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map((item) => (
          <div key={item.label} className="notebook p-3 text-right">
            <div className="stat-label">{item.label}</div>
            <div className="stat-value text-base mt-1">{item.value}</div>
          </div>
        ))}
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
