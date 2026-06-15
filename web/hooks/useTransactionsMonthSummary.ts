'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMonthBill, getCurrentYearMonth, ApiError, type MonthBillItem, type YearMonth } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { useOnLedgerChanged, monthInDetail } from '@/lib/ledgerEvents';

export function useTransactionsMonthSummary({
  year,
  month,
  enabled = true,
}: YearMonth & { enabled?: boolean }) {
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
      const data = await fetchMonthBill(year, month);
      setSummary(data);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ABORTED') return;
      setSummary(null);
      setError(formatApiError(err, '加载月度汇总失败'));
    } finally {
      setLoading(false);
    }
  }, [year, month, enabled]);

  useEffect(() => {
    if (!enabled) {
      setSummary(null);
      setError('');
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError('');

    fetchMonthBill(year, month, { signal: ac.signal })
      .then((data) => {
        if (!ac.signal.aborted) setSummary(data);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        if (err instanceof ApiError && err.code === 'ABORTED') return;
        setSummary(null);
        setError(formatApiError(err, '加载月度汇总失败'));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [year, month, enabled]);

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
