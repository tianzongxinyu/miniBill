'use client';

import { useTranslation } from 'react-i18next';
import { DetailTypeSummaryFilters } from '@/components/contacts/ContactDetailSummaryFilters';
import type { TransactionTypeFilter } from '@/lib/url';

export function TagDetailSummaryFilters({
  expenseCents,
  incomeCents,
  typeFilter,
  onTypeFilterChange,
}: {
  expenseCents: number;
  incomeCents: number;
  typeFilter: TransactionTypeFilter;
  onTypeFilterChange: (type: 'expense' | 'income') => void;
}) {
  const { t } = useTranslation();
  return (
    <DetailTypeSummaryFilters
      expenseCents={expenseCents}
      incomeCents={incomeCents}
      expenseLabel={t('tags.expense')}
      incomeLabel={t('tags.income')}
      expenseAria={t('tags.filterExpenseAria')}
      incomeAria={t('tags.filterIncomeAria')}
      typeFilter={typeFilter}
      onTypeFilterChange={onTypeFilterChange}
    />
  );
}
