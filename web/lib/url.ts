import { getCurrentYearMonth, type YearMonth } from '@/lib/api';

export type YearMonthParseFallback = 'current' | 'null';

function parseYearMonthNumbers(
  yearRaw: string | null,
  monthRaw: string | null,
  fallback: YearMonthParseFallback
): YearMonth | null {
  const y = Number(yearRaw);
  const m = Number(monthRaw);
  if (y > 0 && m >= 1 && m <= 12) return { year: y, month: m };
  if (fallback === 'current') return getCurrentYearMonth();
  return null;
}

/** 流水页：无效年月回退到当月 */
export function parseYearMonthFromQuery(params: URLSearchParams): YearMonth {
  return parseYearMonthNumbers(params.get('year'), params.get('month'), 'current')!;
}

/** 余额页：无效年月返回 null，由调用方用 resolveDefaultBalanceMonth 补默认月 */
export function parseYearMonthQuery(
  yearRaw: string | null,
  monthRaw: string | null
): YearMonth | null {
  return parseYearMonthNumbers(yearRaw, monthRaw, 'null');
}
