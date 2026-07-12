import type { MonthBillItem, Transaction } from '@/lib/api';

/** Derive month income/expense totals from loaded transactions (unfiltered list). */
export function deriveMonthTotalsFromTransactions(items: Transaction[]): {
  totalIncome: number;
  totalExpense: number;
} {
  let totalIncome = 0;
  let totalExpense = 0;
  for (const tx of items) {
    if (tx.is_system) continue;
    if (tx.type === 'income') totalIncome += tx.amount;
    else if (tx.type === 'expense') totalExpense += tx.amount;
  }
  return { totalIncome, totalExpense };
}

/** Overlay client-computed totals when the transaction list is the full unfiltered month. */
export function mergeMonthBillWithTransactionTotals(
  summary: MonthBillItem,
  items: Transaction[]
): MonthBillItem {
  const { totalIncome, totalExpense } = deriveMonthTotalsFromTransactions(items);
  return { ...summary, total_income: totalIncome, total_expense: totalExpense };
}
