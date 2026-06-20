'use client';

import { memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DailyExpenseAmount } from '@/components/ui/DailyExpenseAmount';
import { Amount } from '@/components/ui/Amount';
import { TagChip } from '@/components/ui/TagChip';
import type { Transaction, TransactionTagItem } from '@/lib/api';
import { formatISODate } from '@/lib/formatDate';
import { contactDetailHref, transactionEditHref } from '@/lib/url';
import { stashTransactionsScroll } from '@/lib/scroll';

function tagItemsFor(tx: Transaction): TransactionTagItem[] {
  if (tx.tag_items?.length) return tx.tag_items;
  return (tx.tags ?? []).map((name) => ({ id: 0, name, color_bg: '', color_fg: '' }));
}

function RowBody({ tx, returnTo }: { tx: Transaction; returnTo?: string }) {
  const { t } = useTranslation();
  const isDailySystem = tx.is_system;
  const items = tagItemsFor(tx);
  const hasMeta = items.length > 0 || Boolean(tx.contact_id && tx.contact_name);
  const emDash = t('common.emDash');

  return (
    <div className="flex justify-between gap-4 items-start">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted tabular-nums">{formatISODate(tx.transaction_date)}</div>
        <div className="mt-1 min-h-[1.25rem]">
          {hasMeta ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {items.map((tag) => (
                <TagChip key={tag.id ? tag.id : tag.name} name={tag.name} colorBg={tag.color_bg} />
              ))}
              {tx.contact_id && tx.contact_name && (
                <Link
                  href={contactDetailHref(tx.contact_id, returnTo)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-accent hover:underline shrink-0"
                >
                  @{tx.contact_name}
                </Link>
              )}
            </div>
          ) : (
            <div className="text-sm text-ink truncate">{emDash}</div>
          )}
        </div>
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

function systemDailyCents(tx: Transaction): number {
  return tx.type === 'expense' ? tx.amount : -tx.amount;
}

function TransactionRowInner({
  tx,
  animate,
  returnTo,
}: {
  tx: Transaction;
  animate?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const className = animate ? 'notebook-row animate-fade-in-up' : 'notebook-row';

  if (tx.is_system) {
    return (
      <div className={className}>
        <RowBody tx={tx} returnTo={returnTo} />
      </div>
    );
  }

  const goEdit = () => {
    const href = returnTo ?? '';
    if (href) stashTransactionsScroll(href);
    router.push(transactionEditHref(tx.id, returnTo));
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={goEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goEdit();
        }
      }}
      className={`${className} block cursor-pointer`}
    >
      <RowBody tx={tx} returnTo={returnTo} />
    </div>
  );
}

export const TransactionRow = memo(TransactionRowInner);
