'use client';

import { useCallback, useEffect, useState } from 'react';
import i18n from '@/src/i18n';
import {
  fetchMonthBill,
  getCurrentYearMonth,
  ApiError,
  type MonthBillItem,
  type Transaction,
  type YearMonth,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { useOnLedgerChanged, monthInDetail } from '@/lib/ledgerEvents';
import { mergeMonthBillWithTransactionTotals } from '@/lib/transactionsSummary';

export function useTransactionsMonthSummary({
  year,
  month,
  enabled = true,
  transactions,
  mergeTotalsFromTransactions = false,
}: YearMonth & {
  enabled?: boolean;
  transactions?: Transaction[];
  mergeTotalsFromTransactions?: boolean;
}) {
  const current = getCurrentYearMonth();
  const isHistorical = enabled && (year !== current.year || month !== current.month);

  const [summary, setSummary] = useState<MonthBillItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError('');

    try {
      let data = await fetchMonthBill(year, month);
      if (mergeTotalsFromTransactions && transactions && transactions.length > 0) {
        data = mergeMonthBillWithTransactionTotals(data, transactions);
      }
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ABORTED') return;
      setSummary(null);
      setError(formatApiError(err, i18n.t('transactions.loadSummaryFailed')));
    } finally {
      setLoading(false);
    }
  }, [year, month, enabled, mergeTotalsFromTransactions, transactions]);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setError('');
      setLoading(false);
      return;
    }
    void reload();
  }, [enabled, reload]);

  useOnLedgerChanged(
    useCallback(
      (detail) => {
        if (!enabled) return;
        if (!monthInDetail(detail, year, month)) return;
        void reload();
      },
      [enabled, year, month, reload]
    )
  );

  return { isHistorical, summary, loading, error };
}
