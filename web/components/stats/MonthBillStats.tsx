'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { BalanceAmount } from '@/components/ui/BalanceAmount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { resolveNetIncomeCents } from '@/lib/netIncome';
import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthBillItem } from '@/lib/api';

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
}: {
  item: MonthBillItem;
  variant: 'home' | 'transactions';
  year?: number;
  month?: number;
  editable?: boolean;
}) {
  const { t } = useTranslation();
  const net = resolveNetIncomeCents(item);
  const expense = totalExpenseCents(item.total_expense, item.daily_expense);
  const emDash = t('common.emDash');

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

  if (variant === 'transactions') {
    return (
      <div className="transactions-month-summary-columns">
        <HomeStatStack label={t('stats.balance')}>{balanceCell}</HomeStatStack>
        <HomeStatStack label={t('stats.netIncome')}>
          <SignedAmount cents={net} className="text-sm" />
        </HomeStatStack>
      </div>
    );
  }

  return (
    <div className="bill-card-columns bill-card-columns-compact">
      <div className="bill-card-col bill-card-col-past">
        <HomeStatStack label={t('stats.balance')}>{balanceCell}</HomeStatStack>
        <HomeStatStack label={t('stats.totalExpense')}>
          <Amount cents={expense} type="expense" className="text-sm" />
        </HomeStatStack>
      </div>
      <div className="bill-card-col bill-card-col-past">
        <HomeStatStack label={t('stats.netIncome')}>
          <SignedAmount cents={net} className="text-sm" />
        </HomeStatStack>
        <HomeStatStack label={t('stats.totalIncome')}>
          <Amount cents={item.total_income} type="income" className="text-sm" />
        </HomeStatStack>
      </div>
    </div>
  );
}
