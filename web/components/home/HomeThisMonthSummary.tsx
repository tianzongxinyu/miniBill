'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import type { MonthBillItem } from '@/lib/api';
import { resolveNetIncomeCents } from '@/lib/netIncome';
import { totalExpenseCents } from '@/lib/totalExpense';
import { buildTransactionsHref } from '@/lib/url';

export function HomeThisMonthSummary({ item }: { item: MonthBillItem }) {
  const { t } = useTranslation();
  const net = resolveNetIncomeCents(item);
  const expense = totalExpenseCents(item.total_expense, item.daily_expense);
  const href = buildTransactionsHref({ year: item.year, month: item.month });

  return (
    <Link href={href} className="block">
      <article className="bill-card bill-card-past py-2.5">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <span className="text-xs text-muted shrink-0">{t('home.thisMonth')}</span>
          <div className="bill-stat-stack">
            <div className="bill-stat-stack-label">{t('stats.netIncome')}</div>
            <div className="bill-stat-stack-value">
              <SignedAmount cents={net} className="text-sm font-semibold" />
            </div>
          </div>
        </div>
        <div className="bill-stat-stack-rule my-1.5" aria-hidden />
        <div className="bill-card-columns bill-card-columns-compact">
          <div className="bill-stat-stack">
            <div className="bill-stat-stack-label">{t('stats.totalExpense')}</div>
            <div className="bill-stat-stack-value">
              <Amount cents={expense} type="expense" className="text-sm" />
            </div>
          </div>
          <div className="bill-stat-stack">
            <div className="bill-stat-stack-label">{t('stats.totalIncome')}</div>
            <div className="bill-stat-stack-value">
              <Amount cents={item.total_income} type="income" className="text-sm" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
