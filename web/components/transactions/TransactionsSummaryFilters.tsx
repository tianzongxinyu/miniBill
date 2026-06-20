'use client';

import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthBillItem } from '@/lib/api';
import type { TransactionTypeFilter } from '@/lib/url';

function FilterButton({
  label,
  filterType,
  active,
  ariaLabel,
  onClick,
  children,
}: {
  label: string;
  filterType: 'expense' | 'income';
  active: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`bill-stat-filter-btn bill-stat-filter-btn-${filterType}${active ? ' is-active' : ''}`}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
    >
      <span className="bill-stat-stack-label">{label}</span>
      <span className="bill-stat-stack-value">{children}</span>
    </button>
  );
}

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
    <div className="transactions-month-summary-columns transactions-month-summary-filters">
      <FilterButton
        label={t('stats.totalExpense')}
        filterType="expense"
        active={typeFilter === 'expense'}
        ariaLabel={t('transactions.filterExpenseAria')}
        onClick={() => onTypeFilterChange('expense')}
      >
        <Amount cents={expense} type="expense" className="text-sm" />
      </FilterButton>
      <FilterButton
        label={t('stats.totalIncome')}
        filterType="income"
        active={typeFilter === 'income'}
        ariaLabel={t('transactions.filterIncomeAria')}
        onClick={() => onTypeFilterChange('income')}
      >
        <Amount cents={summary.total_income} type="income" className="text-sm" />
      </FilterButton>
    </div>
  );
}
