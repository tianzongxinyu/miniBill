'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { MonthBillCard } from '@/components/home/MonthBillCard';
import { FixedRecordButton } from '@/components/home/FixedRecordButton';
import { HomeMiniChart } from '@/components/home/HomeMiniChart';
import { HomeThisMonthSummary } from '@/components/home/HomeThisMonthSummary';
import { HomeRecentContacts } from '@/components/home/HomeRecentContacts';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import { useHomeMonthActivity } from '@/hooks/useHomeMonthActivity';
import { fetchMonthBills, type MonthBillItem } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { useOnLedgerChanged, patchMonthBills } from '@/lib/ledgerEvents';

function HomeSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bill-card loading-shimmer !border-0 !shadow-none min-h-[200px]" />
      <div className="bill-card loading-shimmer !border-0 !shadow-none min-h-[88px]" />
      <div className="bill-card loading-shimmer !border-0 !shadow-none min-h-[48px]" />
    </div>
  );
}

function HomeContent() {
  const { t } = useTranslation();
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const fetchPage = useCallback(
    (cursor: string | null) => fetchMonthBills({ cursor, limit: 5 }),
    []
  );

  const { items, setItems, loading, loadingMore, hasMore, error, sentinelRef, loadFirst } =
    useCursorPagination<MonthBillItem>({
      fetchPage,
      onError: (e) => formatApiError(e, t('common.loadFailed')),
    });

  const { contacts: activityContacts, reload: reloadActivity } = useHomeMonthActivity();

  const refresh = useCallback(async () => {
    setChartReloadKey((k) => k + 1);
    await Promise.all([loadFirst(), reloadActivity()]);
  }, [loadFirst, reloadActivity]);

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

  const current = useMemo(() => items.find((i) => i.is_current) ?? null, [items]);
  const past = useMemo(() => items.filter((i) => !i.is_current), [items]);

  const showEnrichment = !loading && items.length > 0;

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
            {pulling
              ? t('home.refreshing')
              : pullDistance >= 64
                ? t('home.releaseRefresh')
                : t('home.pullRefresh')}
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
          {showEnrichment && current && <HomeThisMonthSummary item={current} />}
          {showEnrichment && <HomeMiniChart reloadKey={chartReloadKey} />}
          {showEnrichment && <HomeRecentContacts contacts={activityContacts} />}

          {past.length > 0 && (
            <h2 className="text-xs font-medium text-muted uppercase tracking-wide px-0.5 pt-1">
              {t('home.pastTitle')}
            </h2>
          )}
          {past.map((item, i) => (
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
