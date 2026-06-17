'use client';

import { useEffect } from 'react';
import { fetchMonthBill, nextMonth, type MonthBillItem } from '@/lib/api';

export const LEDGER_CHANGED = 'ledger:changed';
export const LEDGER_META_CHANGED = 'ledger:meta-changed';

export type LedgerKind = 'transaction' | 'balance';

export type LedgerChangedDetail = {
  kind: LedgerKind;
  months?: Array<{ year: number; month: number }>;
};

export function notifyLedgerChanged(detail: LedgerChangedDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEDGER_CHANGED, { detail }));
}

export function notifyLedgerMetaChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LEDGER_META_CHANGED));
}

export function parseYearMonth(date: string): { year: number; month: number } | null {
  const [y, m] = date.split('-').map(Number);
  if (y > 0 && m >= 1 && m <= 12) return { year: y, month: m };
  return null;
}

function collectMonths(...dates: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const months: Array<{ year: number; month: number }> = [];
  for (const d of dates) {
    const ym = d ? parseYearMonth(d) : null;
    if (!ym) continue;
    const key = `${ym.year}-${ym.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    months.push(ym);
  }
  return months;
}

export function notifyTransactionDates(...dates: (string | null | undefined)[]) {
  const months = collectMonths(...dates);
  if (months.length === 0) return;
  notifyLedgerChanged({ kind: 'transaction', months });
}

export function notifyBalanceMonths(year: number, month: number) {
  notifyLedgerChanged({
    kind: 'balance',
    months: [{ year, month }, nextMonth(year, month)],
  });
}

export function monthInDetail(
  detail: LedgerChangedDetail | undefined,
  year: number,
  month: number
): boolean {
  const months = detail?.months;
  if (!months?.length) return true;
  return months.some((m) => m.year === year && m.month === month);
}

export function useOnLedgerChanged(handler: (detail?: LedgerChangedDetail) => void) {
  useEffect(() => {
    const listener = (e: Event) => handler((e as CustomEvent<LedgerChangedDetail>).detail);
    window.addEventListener(LEDGER_CHANGED, listener);
    return () => window.removeEventListener(LEDGER_CHANGED, listener);
  }, [handler]);
}

export async function patchMonthBills(
  setItems: React.Dispatch<React.SetStateAction<MonthBillItem[]>>,
  months: Array<{ year: number; month: number }>
) {
  if (months.length === 0) return;
  const fresh = await Promise.all(
    months.map((m) => fetchMonthBill(m.year, m.month).catch(() => null))
  );
  setItems((prev) => {
    const next = [...prev];
    for (const item of fresh) {
      if (!item) continue;
      const idx = next.findIndex((x) => x.year === item.year && x.month === item.month);
      if (idx >= 0) next[idx] = item;
    }
    return next;
  });
}
