import { compareYearMonth, nextMonth, prevMonth, type YearMonth } from '@/lib/api';

export function TransactionsFooter({
  loadingMore,
  monthFullyLoaded,
  atBottom,
  year,
  month,
  earliest,
  maxMonth,
  onMonthChange,
}: {
  loadingMore: boolean;
  monthFullyLoaded: boolean;
  atBottom: boolean;
  year: number;
  month: number;
  earliest: YearMonth | null;
  maxMonth: YearMonth;
  onMonthChange: (ym: YearMonth) => void;
}) {
  if (loadingMore) {
    return (
      <div className="bill-list-footer">
        <span className="bill-list-footer-text">加载中…</span>
      </div>
    );
  }

  if (!monthFullyLoaded || !atBottom) return null;

  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const canPrev = !earliest || compareYearMonth(prev, earliest) >= 0;
  const canNext = compareYearMonth(next, maxMonth) <= 0;

  if (!canPrev && !canNext) return null;

  return (
    <div className="bill-list-footer !justify-between w-full h-auto py-2">
      {canPrev ? (
        <button type="button" className="btn-ghost px-2 py-2 text-sm" onClick={() => onMonthChange(prev)}>
          上个月
        </button>
      ) : (
        <span aria-hidden />
      )}
      {canNext ? (
        <button type="button" className="btn-ghost px-2 py-2 text-sm" onClick={() => onMonthChange(next)}>
          下个月
        </button>
      ) : (
        <span aria-hidden />
      )}
    </div>
  );
}
