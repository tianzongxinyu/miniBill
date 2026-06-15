import { memo } from 'react';
import Link from 'next/link';
import { DailyExpenseAmount } from '@/components/ui/DailyExpenseAmount';
import { Amount } from '@/components/ui/Amount';
import type { Transaction } from '@/lib/api';

const DAILY_EXPENSE_TAG = '日常支出';

function formatTagLine(tx: Transaction): string {
  if (!tx.tags || tx.tags.length === 0) return '—';
  let line = tx.tags.join(' · ');
  if (tx.tags.includes('人情') && tx.contact_name) {
    line += ` (${tx.contact_name})`;
  }
  return line;
}

function systemDailyCents(tx: Transaction): number {
  return tx.type === 'expense' ? tx.amount : -tx.amount;
}

function RowBody({ tx }: { tx: Transaction }) {
  const isDailySystem =
    tx.is_system || (tx.tags?.includes(DAILY_EXPENSE_TAG) ?? false);

  return (
    <div className="flex justify-between gap-4 items-start">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted tabular-nums">{tx.transaction_date}</div>
        <div className="text-sm text-ink truncate mt-1">{formatTagLine(tx)}</div>
      </div>
      <div className="shrink-0 text-right min-w-0 max-w-[55%]">
        {isDailySystem ? (
          <DailyExpenseAmount cents={systemDailyCents(tx)} className="text-sm" />
        ) : (
          <Amount cents={tx.amount} type={tx.type} className="text-sm" />
        )}
        {tx.note && <div className="text-xs text-muted mt-1 truncate">{tx.note}</div>}
      </div>
    </div>
  );
}

function TransactionRowInner({ tx, animate }: { tx: Transaction; animate?: boolean }) {
  const className = animate ? 'notebook-row animate-fade-in-up' : 'notebook-row';

  if (tx.is_system) {
    return (
      <div className={className}>
        <RowBody tx={tx} />
      </div>
    );
  }

  return (
    <Link href={`/add/?id=${tx.id}`} className={`${className} block`}>
      <RowBody tx={tx} />
    </Link>
  );
}

export const TransactionRow = memo(TransactionRowInner);
