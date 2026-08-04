'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { compareYearMonth, nextMonth, prevMonth, type YearMonth } from '@/lib/api';

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function FooterBar({
  canPrev,
  canNext,
  canWrite,
  prev,
  next,
  addHref,
  onMonthChange,
}: {
  canPrev: boolean;
  canNext: boolean;
  canWrite: boolean;
  prev: YearMonth;
  next: YearMonth;
  addHref: string;
  onMonthChange: (ym: YearMonth) => void;
}) {
  const { t } = useTranslation();

  return (
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
      {canWrite ? (
        <Link href={addHref} className="fab-button fab-button-compact">
          <PlusIcon />
          <span>{t('transactions.addOne')}</span>
        </Link>
      ) : (
        <span className="transactions-footer-nav-spacer" aria-hidden />
      )}
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
  const { canWrite } = useLedgerAccess();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!monthFullyLoaded) return null;

  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const canPrev = !earliest || compareYearMonth(prev, earliest) >= 0;
  const canNext = compareYearMonth(next, maxMonth) <= 0;
  const barProps = { canPrev, canNext, canWrite, prev, next, addHref, onMonthChange };

  return (
    <>
      <div className="transactions-footer pointer-events-none invisible" aria-hidden>
        <FooterBar {...barProps} />
      </div>
      {mounted &&
        createPortal(
          <div className="transactions-footer">
            <FooterBar {...barProps} />
          </div>,
          document.body
        )}
    </>
  );
}
