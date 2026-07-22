'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { compareYearMonth, nextMonth, prevMonth, type YearMonth } from '@/lib/api';

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function TransactionsFooter({
  monthFullyLoaded,
  year,
  month,
  earliest,
  maxMonth,
  addHref,
  onMonthChange,
}: {
  monthFullyLoaded: boolean;
  year: number;
  month: number;
  earliest: YearMonth | null;
  maxMonth: YearMonth;
  addHref: string;
  onMonthChange: (ym: YearMonth) => void;
}) {
  const { t } = useTranslation();

  if (!monthFullyLoaded) return null;

  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const canPrev = !earliest || compareYearMonth(prev, earliest) >= 0;
  const canNext = compareYearMonth(next, maxMonth) <= 0;

  return (
    <div className="transactions-footer">
      <div className="transactions-footer-inner">
        {canPrev ? (
          <button
            type="button"
            className="transactions-footer-nav transactions-footer-nav-prev"
            onClick={() => onMonthChange(prev)}
          >
            {t('transactions.prevMonth')}
          </button>
        ) : (
          <span className="transactions-footer-nav-spacer" aria-hidden />
        )}
        <Link href={addHref} className="fab-button fab-button-compact">
          <PlusIcon />
          <span>{t('transactions.addOne')}</span>
        </Link>
        {canNext ? (
          <button
            type="button"
            className="transactions-footer-nav transactions-footer-nav-next"
            onClick={() => onMonthChange(next)}
          >
            {t('transactions.nextMonth')}
          </button>
        ) : (
          <span className="transactions-footer-nav-spacer" aria-hidden />
        )}
      </div>
    </div>
  );
}
