'use client';

import { useCallback } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { PageHeader, scrollToTop } from '@/components/ui/PageHeader';
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
  const fetchPage = useCallback(
    (cursor: string | null) => fetchMonthBills({ cursor, limit: 5 }),
    []
  );

  const { items, setItems, loading, loadingMore, hasMore, error, sentinelRef, loadFirst } =
    useCursorPagination<MonthBillItem>({
      fetchPage,
      onError: (e) => formatApiError(e, '加载失败'),
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
      <div
        className="overflow-hidden transition-[height] duration-200"
        style={{
          height: pulling || pullDistance > 0 ? Math.max(pullDistance, pulling ? 28 : 0) : 0,
        }}
      >
        <p className="text-center text-[11px] uppercase tracking-widest text-muted pt-1">
          {pulling ? '刷新中' : pullDistance >= 64 ? '松开刷新' : '下拉刷新'}
        </p>
      </div>

      <PageHeader title="概览" sticky onTitleDoubleClick={() => scrollToTop()} />

      {error && (
        <div className="notebook p-5 text-sm text-muted mb-6 border-expense/20 bg-expense/[0.03]">
          {error}
        </div>
      )}

      {loading ? (
        <HomeSkeleton />
      ) : items.length === 0 ? (
        <div className="bill-empty">
          <p className="text-sm text-muted">还没有账单记录</p>
          <p className="text-xs text-muted/80 mt-1">记一笔流水后，这里会按月汇总</p>
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
        {loadingMore && <span className="bill-list-footer-text">加载更多</span>}
        {!hasMore && items.length > 0 && !loadingMore && (
          <span className="bill-list-footer-text">— 已到底 —</span>
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
