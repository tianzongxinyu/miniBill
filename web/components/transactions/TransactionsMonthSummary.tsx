'use client';

import { MonthBillPastStats } from '@/components/stats/MonthBillStats';
import { TransactionsSummaryFilters } from '@/components/transactions/TransactionsSummaryFilters';
import { useTranslation } from 'react-i18next';
import type { MonthBillItem } from '@/lib/api';
import { formatYearMonth } from '@/lib/formatDate';
import type { TransactionTypeFilter } from '@/lib/url';

export function TransactionsMonthSummary({
  loading,
  error,
  summary,
  year,
  month,
  editable = false,
  typeFilter = null,
  onTypeFilterChange,
}: {
  loading: boolean;
  error: string;
  summary: MonthBillItem | null;
  year: number;
  month: number;
  editable?: boolean;
  typeFilter?: TransactionTypeFilter;
  onTypeFilterChange?: (type: 'expense' | 'income') => void;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <article
        className="bill-card bill-card-summary"
        aria-label={t('transactions.loadingSummaryAria')}
        aria-busy
      >
        <p className="text-xs text-muted">{t('transactions.loadingSummary')}</p>
      </article>
    );
  }

  if (error) {
    return <p className="text-expense text-xs mb-3">{error}</p>;
  }

  if (!summary) return null;

  return (
    <div className="transactions-month-summary">
      <article
        className="bill-card bill-card-summary"
        aria-label={t('transactions.monthSummaryAria', {
          period: formatYearMonth({ year: summary.year, month: summary.month }),
        })}
      >
        <MonthBillPastStats
          item={summary}
          variant="transactions"
          year={year}
          month={month}
          editable={editable}
        />
      </article>
      {onTypeFilterChange && (
        <TransactionsSummaryFilters
          summary={summary}
          typeFilter={typeFilter}
          onTypeFilterChange={onTypeFilterChange}
        />
      )}
    </div>
  );
}
