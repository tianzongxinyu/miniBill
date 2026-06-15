import { fetchMonthBill, type MonthSeriesPoint } from '@/lib/api';

export async function fetchMonthSeriesPoint(
  year: number,
  month: number
): Promise<MonthSeriesPoint | null> {
  try {
    const bill = await fetchMonthBill(year, month);
    return {
      year: bill.year,
      month: bill.month,
      total_income: bill.total_income,
      total_expense: bill.total_expense,
      registered_balance: bill.balance ?? null,
      daily_expense: bill.daily_expense ?? null,
    };
  } catch {
    return null;
  }
}
