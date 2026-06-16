'use client';

import { MonthBillPastStats } from '@/components/stats/MonthBillStats';
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
  if (loading) {
    return (
      <section
        className="mb-3 pb-3 border-b border-line/50 min-h-[88px]"
        aria-label="月度汇总加载中"
        aria-busy
      >
        <p className="text-xs text-muted">加载月度汇总…</p>
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
      aria-label={`${summary.year} 年 ${summary.month} 月汇总`}
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
