'use client';

import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { StatFilterButton } from '@/components/ui/StatFilterButton';
import type { TransactionTypeFilter } from '@/lib/url';

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
    <div className="transactions-month-summary-columns transactions-month-summary-filters">
      <StatFilterButton
        label={t('contacts.sent')}
        filterType="expense"
        active={typeFilter === 'expense'}
        ariaLabel={t('contacts.filterSentAria')}
        onClick={() => onTypeFilterChange('expense')}
      >
        <Amount cents={sentCents} type="expense" className="text-sm" />
      </StatFilterButton>
      <StatFilterButton
        label={t('contacts.received')}
        filterType="income"
        active={typeFilter === 'income'}
        ariaLabel={t('contacts.filterReceivedAria')}
        onClick={() => onTypeFilterChange('income')}
      >
        <Amount cents={receivedCents} type="income" className="text-sm" />
      </StatFilterButton>
    </div>
  );
}
