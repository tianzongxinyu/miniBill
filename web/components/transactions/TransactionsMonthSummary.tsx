'use client';

import { MonthBillPastStats } from '@/components/stats/MonthBillStats';
import { useTranslation } from 'react-i18next';
import type { MonthBillItem } from '@/lib/api';

export function TransactionsMonthSummary({
  loading,
  error,
  summary,
  year,
  month,
  editable = false,
}: {
  loading: boolean;
  error: string;
  summary: MonthBillItem | null;
  year: number;
  month: number;
  editable?: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <section
        className="mb-3 pb-3 border-b border-line/50 min-h-[88px]"
        aria-label={t('transactions.loadingSummaryAria')}
        aria-busy
      >
        <p className="text-xs text-muted">{t('transactions.loadingSummary')}</p>
      </section>
    );
  }

  if (error) {
    return <p className="text-expense text-xs mb-3">{error}</p>;
  }

  if (!summary) return null;

  return (
    <section
      className="mb-3 pb-3 border-b border-line/50"
      aria-label={t('transactions.monthSummaryAria', { year: summary.year, month: summary.month })}
    >
      <MonthBillPastStats
        item={summary}
        variant="transactions"
        year={year}
        month={month}
        editable={editable}
      />
    </section>
  );
}
