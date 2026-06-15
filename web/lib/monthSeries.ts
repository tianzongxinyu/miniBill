import { fetchMonthBill, prevMonth, type MonthSeriesPoint } from '@/lib/api';
import { totalExpenseCents } from '@/lib/totalExpense';

export async function fetchMonthSeriesPoint(
  year: number,
  month: number
): Promise<MonthSeriesPoint | null> {
  try {
    const bill = await fetchMonthBill(year, month);
    const expense = totalExpenseCents(bill.total_expense, bill.daily_expense);
    const net = bill.total_income - expense;
    let startBalance: number | null = null;
    if (bill.is_current) {
      const prev = prevMonth(year, month);
      try {
        const prevBill = await fetchMonthBill(prev.year, prev.month);
        startBalance = prevBill.balance ?? null;
      } catch {
        startBalance = null;
      }
    }
    return {
      year: bill.year,
      month: bill.month,
      total_income: bill.total_income,
      total_expense: bill.total_expense,
      start_balance: startBalance,
      registered_balance: bill.is_current
        ? startBalance != null
          ? startBalance + net
          : net
        : (bill.balance ?? null),
      daily_expense: bill.daily_expense ?? null,
    };
  } catch {
    return null;
  }
}
