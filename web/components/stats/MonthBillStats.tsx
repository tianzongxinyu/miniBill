'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { BalanceAmount } from '@/components/ui/BalanceAmount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { resolveNetIncomeCents } from '@/lib/netIncome';
import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthBillItem } from '@/lib/api';
import type { TransactionTypeFilter } from '@/lib/url';

function balanceRegisterHref(year: number, month: number) {
  const returnTo = encodeURIComponent(`/transactions/?year=${year}&month=${month}`);
  return `/balance/?year=${year}&month=${month}&returnTo=${returnTo}`;
}

function HomeStatStack({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bill-stat-stack">
      <div className="bill-stat-stack-label">{label}</div>
      <div className="bill-stat-stack-value">{children}</div>
    </div>
  );
}

function FilterableStatStack({
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

export function MonthBillCurrentSplit({ item }: { item: MonthBillItem }) {
  const { t } = useTranslation();

  return (
    <div className="bill-card-split">
      <div className="bill-stat-item">
        <div className="bill-stat-label">{t('stats.totalExpense')}</div>
        <div className="bill-stat-value mt-1">
          <Amount cents={item.total_expense} type="expense" className="bill-stat-value" />
        </div>
      </div>
      <div className="bill-card-split-divider" aria-hidden />
      <div className="bill-stat-item">
        <div className="bill-stat-label">{t('stats.totalIncome')}</div>
        <div className="bill-stat-value mt-1">
          <Amount cents={item.total_income} type="income" className="bill-stat-value" />
        </div>
      </div>
    </div>
  );
}

export function MonthBillPastStats({
  item,
  variant,
  year,
  month,
  editable = false,
  typeFilter = null,
  onTypeFilterChange,
}: {
  item: MonthBillItem;
  variant: 'home' | 'transactions';
  year?: number;
  month?: number;
  editable?: boolean;
  typeFilter?: TransactionTypeFilter;
  onTypeFilterChange?: (type: 'expense' | 'income') => void;
}) {
  const { t } = useTranslation();
  const net = resolveNetIncomeCents(item);
  const expense = totalExpenseCents(item.total_expense, item.daily_expense);
  const emDash = t('common.emDash');
  const filterable = variant === 'transactions' && onTypeFilterChange != null;

  const linkUnderline =
    'underline underline-offset-2 decoration-ink/45 hover:decoration-accent hover:text-accent';

  const balanceValue =
    item.balance != null ? (
      <BalanceAmount cents={item.balance} className={`text-sm font-bold ${linkUnderline}`} />
    ) : editable && year != null && month != null ? (
      <span className={`text-muted ${linkUnderline}`}>{t('balance.registerBalance')}</span>
    ) : (
      emDash
    );

  const balanceCell =
    editable && year != null && month != null ? (
      <Link href={balanceRegisterHref(year, month)} className="inline transition-colors">
        {balanceValue}
      </Link>
    ) : item.balance != null ? (
      <BalanceAmount cents={item.balance} className="text-sm font-bold" />
    ) : (
      emDash
    );

  return (
    <div className="bill-card-columns bill-card-columns-compact">
      <div className="bill-card-col bill-card-col-past">
        <HomeStatStack label={t('stats.balance')}>{balanceCell}</HomeStatStack>
        <div className="bill-stat-stack-rule" aria-hidden />
        {filterable ? (
          <FilterableStatStack
            label={t('stats.totalExpense')}
            filterType="expense"
            active={typeFilter === 'expense'}
            ariaLabel={t('transactions.filterExpenseAria')}
            onClick={() => onTypeFilterChange('expense')}
          >
            <Amount cents={expense} type="expense" className="text-sm" />
          </FilterableStatStack>
        ) : (
          <HomeStatStack label={t('stats.totalExpense')}>
            <Amount cents={expense} type="expense" className="text-sm" />
          </HomeStatStack>
        )}
      </div>
      <div className="bill-card-split-divider bill-card-split-divider-full" aria-hidden />
      <div className="bill-card-col bill-card-col-past">
        <HomeStatStack label={t('stats.netIncome')}>
          <SignedAmount cents={net} className="text-sm" />
        </HomeStatStack>
        <div className="bill-stat-stack-rule" aria-hidden />
        {filterable ? (
          <FilterableStatStack
            label={t('stats.totalIncome')}
            filterType="income"
            active={typeFilter === 'income'}
            ariaLabel={t('transactions.filterIncomeAria')}
            onClick={() => onTypeFilterChange('income')}
          >
            <Amount cents={item.total_income} type="income" className="text-sm" />
          </FilterableStatStack>
        ) : (
          <HomeStatStack label={t('stats.totalIncome')}>
            <Amount cents={item.total_income} type="income" className="text-sm" />
          </HomeStatStack>
        )}
      </div>
    </div>
  );
}
