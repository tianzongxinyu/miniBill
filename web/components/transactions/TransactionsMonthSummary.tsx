'use client';

import Link from 'next/link';
import { Amount } from '@/components/ui/Amount';
import { BalanceAmount } from '@/components/ui/BalanceAmount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { resolveNetIncomeCents } from '@/lib/netIncome';
import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthBillItem } from '@/lib/api';

function StatItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 min-w-0">
      <dt className="text-xs text-muted shrink-0">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-right m-0">{value}</dd>
    </div>
  );
}

function balanceRegisterHref(year: number, month: number) {
  const returnTo = encodeURIComponent(`/transactions/?year=${year}&month=${month}`);
  return `/balance/?year=${year}&month=${month}&returnTo=${returnTo}`;
}

export function TransactionsMonthSummary({
  loading,
  error,
  summary,
  year,
  month,
  editable = false,
}: {
  loading: boolean;
  error: string;
  summary: MonthBillItem | null;
  year: number;
  month: number;
  editable?: boolean;
}) {
  if (loading) {
    return (
      <section
        className="mb-3 pb-3 border-b border-line/50 min-h-[88px]"
        aria-label="月度汇总加载中"
        aria-busy
      >
        <p className="text-xs text-muted">加载月度汇总…</p>
      </section>
    );
  }

  if (error) {
    return <p className="text-expense text-xs mb-3">{error}</p>;
  }

  if (!summary) return null;

  const net = resolveNetIncomeCents(summary);
  const expense = totalExpenseCents(summary.total_expense, summary.daily_expense);

  const linkUnderline =
    'underline underline-offset-2 decoration-ink/45 hover:decoration-accent hover:text-accent';

  const balanceValue =
    summary.balance != null ? (
      <BalanceAmount cents={summary.balance} className={`text-sm ${linkUnderline}`} />
    ) : editable ? (
      <span className={`text-muted ${linkUnderline}`}>登记余额</span>
    ) : (
      '—'
    );

  const balanceCell = editable ? (
    <Link href={balanceRegisterHref(year, month)} className="inline transition-colors">
      {balanceValue}
    </Link>
  ) : (
    balanceValue
  );

  return (
    <section
      className="mb-3 pb-3 border-b border-line/50"
      aria-label={`${summary.year} 年 ${summary.month} 月汇总`}
    >
      <dl className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-3">
        <StatItem label="余额" value={balanceCell} />
        <div
          className="row-span-2 w-px bg-line/60 self-stretch justify-self-center"
          aria-hidden
        />
        <StatItem label="净收入" value={<SignedAmount cents={net} className="text-sm" />} />
        <StatItem
          label="总支出"
          value={<Amount cents={expense} type="expense" className="text-sm" />}
        />
        <StatItem
          label="总收入"
          value={<Amount cents={summary.total_income} type="income" className="text-sm" />}
        />
      </dl>
    </section>
  );
}
