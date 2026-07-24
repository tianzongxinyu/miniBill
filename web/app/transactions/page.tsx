'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
  parseTransactionTypeFromQuery,
  parseTransactionsFiltersFromQuery,
  parseYearMonthFromQuery,
  type TransactionTypeFilter,
} from '@/lib/url';
import { scrollToTop } from '@/lib/scroll';
import { useEarliestMonth } from '@/hooks/useEarliestMonth';
import { getCurrentYearMonth, type YearMonth } from '@/lib/api';

function TransactionsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const urlYear = params.get('year');
  const urlMonth = params.get('month');
  const urlNote = params.get('note');
  const urlTags = params.get('tags');
  const urlContact = params.get('contact');
  const urlMatch = params.get('match');
  const urlType = params.get('type');
  const initial = parseYearMonthFromQuery(params);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>(() =>
    parseTransactionTypeFromQuery(params)
  );
  const earliest = useEarliestMonth();
  const {
    noteQuery,
    setNoteQuery,
    debouncedNote,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    tagMatch,
    setTagMatch,
    apiTagMatch,
    matchToggleVisible,
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
    if (urlNote == null && urlTags == null && urlContact == null && urlMatch == null) return;
    hydrateSearchFilters(parseTransactionsFiltersFromQuery(params));
  }, [urlNote, urlTags, urlContact, urlMatch, params, hydrateSearchFilters]);

  useEffect(() => {
    setTypeFilter(parseTransactionTypeFromQuery(params));
  }, [urlType, params]);

  const list = useTransactionsList({
    year,
    month,
    note: debouncedNote,
    tagIds: selectedTagIds,
    contactId,
    tagMatch: apiTagMatch,
    searchActive,
    typeFilter,
  });

  const monthSummary = useTransactionsMonthSummary({
    year,
    month,
    enabled: !searchActive,
    transactions: list.items,
    mergeTotalsFromTransactions: !searchActive && !typeFilter,
  });

  const syncTransactionsUrl = useCallback(
    (ym: YearMonth, type: TransactionTypeFilter) => {
      router.replace(
        buildTransactionsHref({
          year: ym.year,
          month: ym.month,
          ...(type ? { type } : {}),
        })
      );
    },
    [router]
  );

  const handleTypeFilterChange = useCallback(
    (type: 'expense' | 'income') => {
      const next: TransactionTypeFilter = typeFilter === type ? null : type;
      setTypeFilter(next);
      scrollToTop(false);
      syncTransactionsUrl({ year, month }, next);
    },
    [typeFilter, year, month, syncTransactionsUrl]
  );

  const handleMonthChange = useCallback((ym: YearMonth) => {
    setYear(ym.year);
    setMonth(ym.month);
  }, []);

  const handleTagClick = useCallback(
    (tagId: number) => {
      setSelectedTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
      scrollToTop(false);
    },
    [setSelectedTagIds]
  );

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
        tagMatch: searchActive ? apiTagMatch : undefined,
        ...(typeFilter && !searchActive ? { type: typeFilter } : {}),
      }),
    [year, month, searchActive, debouncedNote, selectedTagIds, contactId, apiTagMatch, typeFilter]
  );

  const emptyMessage = useMemo(() => {
    if (searchActive) return t('transactions.noMatch');
    if (typeFilter === 'expense') return t('transactions.emptyExpense');
    if (typeFilter === 'income') return t('transactions.emptyIncome');
    return t('transactions.empty');
  }, [searchActive, typeFilter, t]);

  const addHref = useMemo(
    () => buildAddHref({ year, month, returnTo: transactionsHref }),
    [year, month, transactionsHref]
  );

  return (
    <div className="pb-28 lg:pb-24">
      <TransactionsToolbar
        note={noteQuery}
        onNoteChange={setNoteQuery}
        selectedTagIds={selectedTagIds}
        onTagIdsChange={setSelectedTagIds}
        contactId={contactId}
        onContactIdChange={setContactId}
        tagMatch={tagMatch}
        onTagMatchChange={setTagMatch}
        matchToggleVisible={matchToggleVisible}
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
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
        />
      )}

      {list.error && <p className="text-expense text-sm mb-2">{list.error}</p>}

      {list.loading ? (
        <ListSkeleton />
      ) : list.items.length === 0 ? (
        <EmptyNotebook message={emptyMessage} />
      ) : (
        <Notebook>
          {list.items.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              animate={animateIds.has(tx.id)}
              returnTo={transactionsHref}
              onTagClick={handleTagClick}
            />
          ))}
        </Notebook>
      )}

      {searchActive && list.hasMore && (
        <div ref={list.sentinelRef} className="h-4" aria-hidden />
      )}

      {!searchActive && (
        <TransactionsFooter
          monthFullyLoaded={!list.loading}
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
