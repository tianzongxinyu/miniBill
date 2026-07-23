'use client';

import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { StatFilterButton } from '@/components/ui/StatFilterButton';
import type { TransactionTypeFilter } from '@/lib/url';

export function DetailTypeSummaryFilters({
  expenseCents,
  incomeCents,
  expenseLabel,
  incomeLabel,
  expenseAria,
  incomeAria,
  typeFilter,
  onTypeFilterChange,
}: {
  expenseCents: number;
  incomeCents: number;
  expenseLabel: string;
  incomeLabel: string;
  expenseAria: string;
  incomeAria: string;
  typeFilter: TransactionTypeFilter;
  onTypeFilterChange: (type: 'expense' | 'income') => void;
}) {
  return (
    <div className="transactions-month-summary-columns transactions-month-summary-filters">
      <StatFilterButton
        label={expenseLabel}
        filterType="expense"
        active={typeFilter === 'expense'}
        ariaLabel={expenseAria}
        onClick={() => onTypeFilterChange('expense')}
      >
        <Amount cents={expenseCents} type="expense" className="text-sm" />
      </StatFilterButton>
      <StatFilterButton
        label={incomeLabel}
        filterType="income"
        active={typeFilter === 'income'}
        ariaLabel={incomeAria}
        onClick={() => onTypeFilterChange('income')}
      >
        <Amount cents={incomeCents} type="income" className="text-sm" />
      </StatFilterButton>
    </div>
  );
}

export function ContactDetailSummaryFilters({
  sentCents,
  receivedCents,
  typeFilter,
  onTypeFilterChange,
}: {
  sentCents: number;
  receivedCents: number;
  typeFilter: TransactionTypeFilter;
  onTypeFilterChange: (type: 'expense' | 'income') => void;
}) {
  const { t } = useTranslation();
  return (
    <DetailTypeSummaryFilters
      expenseCents={sentCents}
      incomeCents={receivedCents}
      expenseLabel={t('contacts.sent')}
      incomeLabel={t('contacts.received')}
      expenseAria={t('contacts.filterSentAria')}
      incomeAria={t('contacts.filterReceivedAria')}
      typeFilter={typeFilter}
      onTypeFilterChange={onTypeFilterChange}
    />
  );
}
