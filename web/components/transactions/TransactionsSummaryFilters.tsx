'use client';

import { useTranslation } from 'react-i18next';
import { DetailTypeSummaryFilters } from '@/components/contacts/ContactDetailSummaryFilters';
import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthBillItem } from '@/lib/api';
import type { TransactionTypeFilter } from '@/lib/url';

export function TransactionsSummaryFilters({
  summary,
  typeFilter,
  onTypeFilterChange,
}: {
  summary: MonthBillItem;
  typeFilter: TransactionTypeFilter;
  onTypeFilterChange: (type: 'expense' | 'income') => void;
}) {
  const { t } = useTranslation();
  const expense = totalExpenseCents(summary.total_expense, summary.daily_expense);

  return (
    <DetailTypeSummaryFilters
      expenseCents={expense}
      incomeCents={summary.total_income}
      expenseLabel={t('stats.totalExpense')}
      incomeLabel={t('stats.totalIncome')}
      expenseAria={t('transactions.filterExpenseAria')}
      incomeAria={t('transactions.filterIncomeAria')}
      typeFilter={typeFilter}
      onTypeFilterChange={onTypeFilterChange}
    />
  );
}
