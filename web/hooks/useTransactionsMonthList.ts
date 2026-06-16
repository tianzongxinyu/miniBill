'use client';

import { useTransactionsList } from '@/hooks/useTransactionsList';

export { useTransactionsList } from '@/hooks/useTransactionsList';

/** @deprecated use useTransactionsList */
export function useTransactionsMonthList(year: number, month: number) {
  return useTransactionsList({
    year,
    month,
    note: '',
    tagIds: [],
    contactId: null,
    searchActive: false,
  });
}
