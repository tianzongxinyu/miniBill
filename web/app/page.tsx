'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { MonthBillCard } from '@/components/home/MonthBillCard';
import { FixedRecordButton } from '@/components/home/FixedRecordButton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import { fetchMonthBills, MonthBillItem } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { useOnLedgerChanged, patchMonthBills } from '@/lib/ledgerEvents';

function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bill-card loading-shimmer !border-0 !shadow-none min-h-[108px]"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

function HomeContent() {
  const { t } = useTranslation();
  const fetchPage = useCallback(
    (cursor: string | null) => fetchMonthBills({ cursor, limit: 5 }),
    []
  );

  const { items, setItems, loading, loadingMore, hasMore, error, sentinelRef, loadFirst } =
    useCursorPagination<MonthBillItem>({
      fetchPage,
      onError: (e) => formatApiError(e, t('home.loadFailed')),
    });

  const refresh = useCallback(async () => {
    await loadFirst();
  }, [loadFirst]);

  useOnLedgerChanged(
    useCallback(
      (detail) => {
        const months = detail?.months;
        if (!months?.length) return;
        void patchMonthBills(setItems, months);
      },
      [setItems]
    )
  );

  const { pulling, pullDistance } = usePullToRefresh(refresh);

  return (
    <div className="pb-28 lg:pb-24">
      {(pulling || pullDistance > 0) && (
        <div
          className="fixed inset-x-0 top-0 z-30 flex justify-center pointer-events-none pt-[max(0.25rem,env(safe-area-inset-top))]"
          style={{
            transform: `translateY(${pulling ? 28 : pullDistance}px)`,
            transition: pulling ? 'transform 0.2s ease-out' : 'none',
          }}
        >
          <p className="text-center text-[11px] uppercase tracking-widest text-muted">
            {pulling ? t('home.refreshing') : pullDistance >= 64 ? t('home.releaseRefresh') : t('home.pullRefresh')}
          </p>
        </div>
      )}
      {error && (
        <div className="notebook p-5 text-sm text-muted mb-6 border-expense/20 bg-expense/[0.03]">
          {error}
        </div>
      )}

      {loading ? (
        <HomeSkeleton />
      ) : items.length === 0 ? (
        <div className="bill-empty">
          <p className="text-sm text-muted">{t('home.emptyTitle')}</p>
          <p className="text-xs text-muted/80 mt-1">{t('home.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div
              key={`${item.year}-${item.month}`}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
            >
              <MonthBillCard item={item} />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="bill-list-footer">
        {loadingMore && <span className="bill-list-footer-text">{t('common.loadMore')}</span>}
        {!hasMore && items.length > 0 && !loadingMore && (
          <span className="bill-list-footer-text">{t('common.endOfListDivider')}</span>
        )}
      </div>

      <FixedRecordButton />
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}
