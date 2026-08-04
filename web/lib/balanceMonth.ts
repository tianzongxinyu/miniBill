import { getCurrentYearMonth, prevMonth, type YearMonth } from '@/lib/api';

/** Calendar day (inclusive) when the current month becomes registerable. */
export const BALANCE_MONTH_OPEN_DAY = 25;

/**
 * Latest year-month that may be registered at `date`.
 * Days 1–24 → previous month; day >= 25 → current month.
 */
export function maxRegisterableBalanceMonth(date = new Date()): YearMonth {
  const current = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
  if (date.getDate() < BALANCE_MONTH_OPEN_DAY) {
    return prevMonth(current.year, current.month);
  }
  return current;
}

/** New registration default month (same rule as maxRegisterableBalanceMonth). */
export function resolveDefaultBalanceMonth(date = new Date()): YearMonth {
  return maxRegisterableBalanceMonth(date);
}
