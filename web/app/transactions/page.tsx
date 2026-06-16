'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { Notebook } from '@/components/ui/Notebook';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { ListSkeleton, LoadingFallback } from '@/components/ui/LoadingFallback';
import { TransactionRow } from '@/components/transactions/TransactionRow';
import { TransactionsFooter } from '@/components/transactions/TransactionsFooter';
import { TransactionsMonthSummary } from '@/components/transactions/TransactionsMonthSummary';
import { TransactionsToolbar } from '@/components/transactions/TransactionsToolbar';
import { useDebouncedSearchFilter } from '@/hooks/useDebouncedSearchFilter';
import { useLoadMoreAnimateIds } from '@/hooks/useLoadMoreAnimateIds';
import { useTransactionsList } from '@/hooks/useTransactionsList';
import { useTransactionsMonthSummary } from '@/hooks/useTransactionsMonthSummary';
import {
  buildAddHref,
  buildTransactionsHref,
  parseTransactionsFiltersFromQuery,
  parseYearMonthFromQuery,
} from '@/lib/url';
import { fetchEarliestMonth, getCurrentYearMonth, type YearMonth } from '@/lib/api';

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

  const list = useTransactionsList({
    year,
    month,
    note: debouncedNote,
    tagIds: selectedTagIds,
    contactId,
    searchActive,
  });

  const monthSummary = useTransactionsMonthSummary({ year, month, enabled: !searchActive });

  const handleMonthChange = useCallback((ym: YearMonth) => {
    setYear(ym.year);
    setMonth(ym.month);
  }, []);

  const maxMonth = getCurrentYearMonth();

  const animateIds = useLoadMoreAnimateIds(
    list.items,
    list.loading,
    list.loadingMore,
    (tx) => tx.id
  );

  const transactionsHref = useMemo(
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

  const addHref = useMemo(
    () => buildAddHref({ year, month, returnTo: transactionsHref }),
    [year, month, transactionsHref]
  );

  return (
    <div className="pb-16">
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
        <EmptyNotebook message={searchActive ? '无匹配流水' : '暂无流水'} />
      ) : (
        <Notebook>
          {list.items.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              animate={animateIds.has(tx.id)}
              returnTo={transactionsHref}
            />
          ))}
        </Notebook>
      )}

      {list.hasMore && <div ref={list.sentinelRef} className="h-4" aria-hidden />}

      {!searchActive && (
        <TransactionsFooter
          loadingMore={list.loadingMore}
          monthFullyLoaded={list.isFullyLoaded}
          year={year}
          month={month}
          earliest={earliest}
          maxMonth={maxMonth}
          addHref={addHref}
          onMonthChange={handleMonthChange}
        />
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
