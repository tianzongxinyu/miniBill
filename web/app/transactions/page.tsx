'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { PageHeader, scrollToTop } from '@/components/ui/PageHeader';
import { Notebook } from '@/components/ui/Notebook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { ListSkeleton, LoadingFallback } from '@/components/ui/LoadingFallback';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { TransactionsFooter } from '@/components/transactions/TransactionsFooter';
import { TransactionsMonthSummary } from '@/components/transactions/TransactionsMonthSummary';
import { TransactionsToolbar } from '@/components/transactions/TransactionsToolbar';
import { useDebouncedSearchFilter } from '@/hooks/useDebouncedSearchFilter';
import { useLoadMoreAnimateIds } from '@/hooks/useLoadMoreAnimateIds';
import { useTransactionsList } from '@/hooks/useTransactionsList';
import { useTransactionsMonthNav } from '@/hooks/useTransactionsMonthNav';
import { useTransactionsMonthSummary } from '@/hooks/useTransactionsMonthSummary';
import {
  buildTransactionsHref,
  parseTransactionsFiltersFromQuery,
  parseYearMonthFromQuery,
} from '@/lib/url';
import {
  fetchEarliestMonth,
  getCurrentYearMonth,
  prevMonth,
  type YearMonth,
} from '@/lib/api';

function TransactionsContent() {
  const params = useSearchParams();
  const urlYear = params.get('year');
  const urlMonth = params.get('month');
  const urlNote = params.get('note');
  const urlTags = params.get('tags');
  const urlContact = params.get('contact');
  const initial = parseYearMonthFromQuery(params);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [earliest, setEarliest] = useState<YearMonth | null>(null);
  const {
    noteQuery,
    setNoteQuery,
    debouncedNote,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    searchActive,
    clearSearch,
    hydrateSearchFilters,
  } = useDebouncedSearchFilter();

  useEffect(() => {
    if (urlYear == null && urlMonth == null) return;
    const ym = parseYearMonthFromQuery(params);
    setYear(ym.year);
    setMonth(ym.month);
  }, [urlYear, urlMonth, params]);

  useEffect(() => {
    if (urlNote == null && urlTags == null && urlContact == null) return;
    hydrateSearchFilters(parseTransactionsFiltersFromQuery(params));
  }, [urlNote, urlTags, urlContact, params, hydrateSearchFilters]);

  useEffect(() => {
    fetchEarliestMonth().then(setEarliest).catch(() => setEarliest(null));
  }, []);

  const goPrevMonth = useCallback(() => {
    const p = prevMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  }, [year, month]);

  // nav 与 list hook 互相依赖：list 需要 nav 的 markLoadSettling，nav 需要 list 的加载状态。
  // 用 ref 先挂回调、后赋值 nav，避免违反 hook 调用顺序。
  const navRef = useRef<ReturnType<typeof useTransactionsMonthNav> | null>(null);
  const navCallbacks = useRef({
    markLoadSettling: () => navRef.current?.markLoadSettling(),
    resetAll: () => navRef.current?.resetAll(),
  });

  const list = useTransactionsList({
    year,
    month,
    note: debouncedNote,
    tagIds: selectedTagIds,
    contactId,
    searchActive,
    navCallbacks: navCallbacks.current,
  });

  const monthSummary = useTransactionsMonthSummary({ year, month, enabled: !searchActive });

  const nav = useTransactionsMonthNav({
    year,
    month,
    monthFullyLoaded: list.isFullyLoaded,
    loading: list.loading,
    loadingMore: list.loadingMore,
    hasMore: list.hasMore,
    earliest,
    onGoPrevMonth: goPrevMonth,
    enabled: !searchActive,
  });

  navRef.current = nav;

  const handleMonthChange = useCallback(
    (ym: YearMonth) => {
      nav.resetAll();
      setYear(ym.year);
      setMonth(ym.month);
    },
    [nav]
  );

  const jumpToCurrentMonth = useCallback(() => {
    const now = getCurrentYearMonth();
    if (year === now.year && month === now.month) {
      scrollToTop();
      return;
    }
    nav.resetAll();
    setYear(now.year);
    setMonth(now.month);
    scrollToTop();
  }, [year, month, nav]);

  const maxMonth = getCurrentYearMonth();
  const prevMonthTarget = prevMonth(year, month);

  const animateIds = useLoadMoreAnimateIds(
    list.items,
    list.loading,
    list.loadingMore,
    (tx) => tx.id
  );

  const contactReturnTo = useMemo(
    () =>
      buildTransactionsHref({
        year,
        month,
        note: searchActive ? debouncedNote : undefined,
        tagIds: searchActive ? selectedTagIds : undefined,
        contactId: searchActive ? contactId : undefined,
      }),
    [year, month, searchActive, debouncedNote, selectedTagIds, contactId]
  );

  return (
    <div className="pb-16">
      <PageHeader
        title="流水"
        sticky
        onTitleDoubleClick={jumpToCurrentMonth}
        doubleClickHint="双击回到当前月"
      />

      <TransactionsToolbar
        note={noteQuery}
        onNoteChange={setNoteQuery}
        selectedTagIds={selectedTagIds}
        onTagIdsChange={setSelectedTagIds}
        contactId={contactId}
        onContactIdChange={setContactId}
        onClear={clearSearch}
        searchActive={searchActive}
        month={{ year, month }}
        onMonthChange={handleMonthChange}
        earliest={earliest}
        maxMonth={maxMonth}
      />

      {!searchActive && (
        <TransactionsMonthSummary
          loading={monthSummary.loading}
          error={monthSummary.error}
          summary={monthSummary.summary}
          year={year}
          month={month}
          editable
        />
      )}

      {list.error && <p className="text-expense text-sm mb-4">{list.error}</p>}

      {list.loading ? (
        <ListSkeleton />
      ) : list.items.length === 0 ? (
        <EmptyNotebook
          message={searchActive ? '无匹配流水' : '暂无流水'}
          hint={
            !searchActive && nav.canPromptPrevMonth && list.isFullyLoaded
              ? '下滑至底部后可查看更早月份'
              : undefined
          }
        />
      ) : (
        <Notebook>
          {list.items.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              animate={animateIds.has(tx.id)}
              returnTo={contactReturnTo}
            />
          ))}
        </Notebook>
      )}

      <div ref={list.sentinelRef} className="h-4" aria-hidden />

      {!searchActive && (
        <>
          <TransactionsFooter
            loadingMore={list.loadingMore}
            prevMonthDialogOpen={nav.prevMonthDialogOpen}
            monthFullyLoaded={list.isFullyLoaded}
            atBottom={nav.atBottom}
            canPromptPrevMonth={nav.canPromptPrevMonth}
          />

          <ConfirmDialog
            open={nav.prevMonthDialogOpen}
            title="查看上一个月"
            message={
              list.items.length === 0
                ? `${year} 年 ${month} 月暂无流水，是否查看 ${prevMonthTarget.year} 年 ${prevMonthTarget.month} 月？`
                : `${year} 年 ${month} 月流水已加载完毕，是否查看 ${prevMonthTarget.year} 年 ${prevMonthTarget.month} 月？`
            }
            confirmLabel="查看"
            cancelLabel="留在此月"
            onConfirm={nav.confirmGoPrevMonth}
            onClose={nav.cancelGoPrevMonth}
          />
        </>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <TransactionsContent />
      </Suspense>
    </RequireAuth>
  );
}
