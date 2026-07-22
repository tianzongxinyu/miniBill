'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchTransactions,
  getCurrentYearMonth,
  type Transaction,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { uniqueRecentContacts, type HomeRecentContact } from '@/lib/homeRecentContacts';
import { useOnLedgerChanged } from '@/lib/ledgerEvents';
import { useTranslation } from 'react-i18next';

export const HOME_MONTH_TX_LIMIT = 30;
export const HOME_RECENT_CONTACT_LIMIT = 6;

export function useHomeMonthActivity() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const ym = getCurrentYearMonth();
    setLoading(true);
    setError(null);
    try {
      const page = await fetchTransactions({
        year: ym.year,
        month: ym.month,
        limit: HOME_MONTH_TX_LIMIT,
      });
      setTransactions(page.items);
    } catch (e) {
      setError(formatApiError(e, t('common.loadFailed')));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useOnLedgerChanged(
    useCallback(() => {
      void load();
    }, [load])
  );

  const contacts: HomeRecentContact[] = uniqueRecentContacts(
    transactions,
    HOME_RECENT_CONTACT_LIMIT
  );

  return {
    contacts,
    loading,
    error,
    reload: load,
  };
}
