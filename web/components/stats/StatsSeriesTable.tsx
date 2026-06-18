'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { BalanceAmount } from '@/components/ui/BalanceAmount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { Notebook } from '@/components/ui/Notebook';
import { getCurrentYearMonth } from '@/lib/api';
import { isSeriesVisible, type StatsChartRow } from '@/lib/statsChartData';

function transactionsMonthForYear(year: number): number {
  const now = getCurrentYearMonth();
  if (year === now.year) return now.month;
  return 12;
}

type StatsSeriesTableProps = {
  mode: 'month' | 'year';
  rows: StatsChartRow[];
  searchActive: boolean;
  hiddenSeries: Set<string>;
};

export function StatsSeriesTable({ mode, rows, searchActive, hiddenSeries }: StatsSeriesTableProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const tableRows = useMemo(() => [...rows].reverse(), [rows]);
  const showIncome = isSeriesVisible(hiddenSeries, 'income');
  const showExpense = isSeriesVisible(hiddenSeries, 'expense');
  const showNet = !searchActive && isSeriesVisible(hiddenSeries, 'net');
  const showBalance = !searchActive && isSeriesVisible(hiddenSeries, 'balance');
  const emDash = t('common.emDash');

  const goToRow = (row: StatsChartRow) => {
    if (mode === 'month' && row.month != null) {
      router.push(`/transactions/?year=${row.year}&month=${row.month}`);
      return;
    }
    router.push(`/transactions/?year=${row.year}&month=${transactionsMonthForYear(row.year)}`);
  };

  if (tableRows.length === 0) return null;

  return (
    <Notebook className="overflow-x-auto mb-3">
      <table className="table-auto w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="px-3 py-3 text-left font-medium whitespace-nowrap">{t('stats.date')}</th>
            {showIncome && (
              <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t('stats.income')}</th>
            )}
            {showExpense && (
              <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t('stats.expense')}</th>
            )}
            {showNet && (
              <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t('stats.netIncome')}</th>
            )}
            {showBalance && (
              <th className="px-3 py-3 text-right font-medium whitespace-nowrap">{t('stats.balance')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr
              key={row.key}
              className="border-b border-line last:border-b-0 cursor-pointer hover:bg-accent-soft/40"
              onClick={() => goToRow(row)}
            >
              <td className="px-3 py-3 text-ink whitespace-nowrap">{row.shortLabel}</td>
              {showIncome && (
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <Amount cents={row.incomeCents} type="income" className="text-sm" />
                </td>
              )}
              {showExpense && (
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <Amount cents={row.expenseCents} type="expense" className="text-sm" />
                </td>
              )}
              {showNet && (
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <SignedAmount cents={row.netCents} className="text-sm" />
                </td>
              )}
              {showBalance && (
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  {row.balanceCents != null ? (
                    <BalanceAmount cents={row.balanceCents} className="text-sm" />
                  ) : (
                    emDash
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Notebook>
  );
}
