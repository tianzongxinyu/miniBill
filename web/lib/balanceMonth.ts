import { getCurrentYearMonth, prevMonth, type YearMonth } from '@/lib/api';

/** 新增登记：1–15 日登记上月，16 日及以后登记当月。 */
export function resolveDefaultBalanceMonth(date = new Date()): YearMonth {
  const current = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
  if (date.getDate() <= 15) {
    return prevMonth(current.year, current.month);
  }
  return current;
}
