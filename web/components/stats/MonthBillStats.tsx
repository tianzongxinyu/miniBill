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

export function MonthBillCurrentSplit({ item }: { item: MonthBillItem }) {
  const { t } = useTranslation();

  return (
    <div className="bill-card-split">
      <div className="bill-stat-item">
        <div className="bill-stat-label">{t('stats.totalExpense')}</div>
        <div className="bill-stat-value-lg mt-1">
          <Amount cents={item.total_expense} type="expense" className="bill-stat-value-lg" />
        </div>
      </div>
      <div className="bill-card-split-divider" aria-hidden />
      <div className="bill-stat-item">
        <div className="bill-stat-label">{t('stats.totalIncome')}</div>
        <div className="bill-stat-value-lg mt-1">
          <Amount cents={item.total_income} type="income" className="bill-stat-value-lg" />
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

  if (variant === 'home') {
    return (
      <div className="bill-card-columns">
        <div className="bill-card-col">
          <div className="bill-stat-row">
            <span className="bill-stat-row-label">{t('stats.balance')}</span>
            <span className="bill-stat-row-value font-bold">
              {item.balance != null ? (
                <BalanceAmount cents={item.balance} className="text-sm font-bold" />
              ) : (
                emDash
              )}
            </span>
          </div>
          <div className="bill-stat-row">
            <span className="bill-stat-row-label">{t('stats.totalExpense')}</span>
            <span className="bill-stat-row-value">
              <Amount cents={expense} type="expense" className="text-sm" />
            </span>
          </div>
        </div>
        <div className="bill-card-split-divider bill-card-split-divider-full" aria-hidden />
        <div className="bill-card-col">
          <div className="bill-stat-row">
            <span className="bill-stat-row-label">{t('stats.netIncome')}</span>
            <span className="bill-stat-row-value">
              <SignedAmount cents={net} className="text-sm" />
            </span>
          </div>
          <div className="bill-stat-row">
            <span className="bill-stat-row-label">{t('stats.totalIncome')}</span>
            <span className="bill-stat-row-value">
              <Amount cents={item.total_income} type="income" className="text-sm" />
            </span>
          </div>
        </div>
      </div>
    );
  }

  const linkUnderline =
    'underline underline-offset-2 decoration-ink/45 hover:decoration-accent hover:text-accent';

  const balanceValue =
    item.balance != null ? (
      <BalanceAmount cents={item.balance} className={`text-sm ${linkUnderline}`} />
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
    ) : (
      balanceValue
    );

  return (
    <dl className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-3">
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <dt className="text-xs text-muted shrink-0">{t('stats.balance')}</dt>
        <dd className="text-sm font-medium tabular-nums text-right m-0">{balanceCell}</dd>
      </div>
      <div
        className="row-span-2 w-px bg-line/60 self-stretch justify-self-center"
        aria-hidden
      />
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <dt className="text-xs text-muted shrink-0">{t('stats.netIncome')}</dt>
        <dd className="text-sm font-medium tabular-nums text-right m-0">
          <SignedAmount cents={net} className="text-sm" />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <dt className="text-xs text-muted shrink-0">{t('stats.totalExpense')}</dt>
        <dd className="text-sm font-medium tabular-nums text-right m-0">
          <Amount cents={expense} type="expense" className="text-sm" />
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <dt className="text-xs text-muted shrink-0">{t('stats.totalIncome')}</dt>
        <dd className="text-sm font-medium tabular-nums text-right m-0">
          <Amount cents={item.total_income} type="income" className="text-sm" />
        </dd>
      </div>
    </dl>
  );
}
