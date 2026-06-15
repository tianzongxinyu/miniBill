'use client';

import { Amount } from '@/components/ui/Amount';
import { BalanceAmount } from '@/components/ui/BalanceAmount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { resolveNetIncomeCents } from '@/lib/netIncome';
import { totalExpenseCents } from '@/lib/totalExpense';
import { MonthBillItem } from '@/lib/api';

function MonthStatItem({
  label,
  value,
  large,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  large?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="bill-stat-item">
      <div className="bill-stat-label">{label}</div>
      <div
        className={`${large ? 'bill-stat-value-lg' : 'bill-stat-value'} mt-1 ${bold ? 'font-bold' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function MonthStatRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="bill-stat-row">
      <span className="bill-stat-row-label">{label}</span>
      <span className={`bill-stat-row-value ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}

export function MonthStatsGrid({ item }: { item: MonthBillItem }) {
  if (item.is_current) {
    return (
      <div className="bill-card-split">
        <MonthStatItem
          label="总支出"
          value={<Amount cents={item.total_expense} type="expense" className="bill-stat-value-lg" />}
          large
        />
        <div className="bill-card-split-divider" aria-hidden />
        <MonthStatItem
          label="总收入"
          value={<Amount cents={item.total_income} type="income" className="bill-stat-value-lg" />}
          large
        />
      </div>
    );
  }

  const net = resolveNetIncomeCents(item);
  const expense = totalExpenseCents(item.total_expense, item.daily_expense);

  return (
    <div className="bill-card-columns">
      <div className="bill-card-col">
        <MonthStatRow
          label="余额"
          value={
            item.balance != null ? (
              <BalanceAmount cents={item.balance} className="text-sm font-bold" />
            ) : (
              '—'
            )
          }
          bold
        />
        <MonthStatRow
          label="总支出"
          value={<Amount cents={expense} type="expense" className="text-sm" />}
        />
      </div>
      <div className="bill-card-split-divider bill-card-split-divider-full" aria-hidden />
      <div className="bill-card-col">
        <MonthStatRow
          label="净收入"
          value={<SignedAmount cents={net} className="text-sm" />}
        />
        <MonthStatRow
          label="总收入"
          value={<Amount cents={item.total_income} type="income" className="text-sm" />}
        />
      </div>
    </div>
  );
}
