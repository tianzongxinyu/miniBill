'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/components/SettingsProvider';
import type { HomeRankingContact } from '@/lib/api';
import { chartStrokeForType } from '@/lib/amountColors';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

const BREAK_RATIO = 2;
const VISUAL_PAD = 1.2;
const MIN_FILL_PX = 4;
const TRACK_CLASS = 'bg-ink/40';
const NAME_COL_CLASS = 'w-auto max-w-[40%] shrink-0 px-0 text-center';
const AMOUNT_LABEL_CLASS =
  'amount-num absolute inset-y-0 z-[1] flex items-center text-[11px] tabular-nums leading-none text-white drop-shadow-[0_0.5px_0_rgba(0,0,0,0.18)]';

type TornadoRow = {
  id: number;
  name: string;
  useCount: number;
  income: number;
  expense: number;
};

function formatTornadoAmount(cents: number, locale: string, sign: '+' | '-'): string {
  const body = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
  return `${sign}${body}`;
}

function sumContact(c: HomeRankingContact): TornadoRow {
  let income = 0;
  let expense = 0;
  for (const p of c.points ?? []) {
    income += p.total_income ?? 0;
    expense += p.total_expense ?? 0;
  }
  return {
    id: c.id,
    name: c.name,
    useCount: c.use_count ?? 0,
    income,
    expense,
  };
}

function computeVisualMax(amounts: number[]): { visualMax: number; breakAxis: boolean } {
  const nonzero = amounts.filter((a) => a > 0).sort((a, b) => b - a);
  if (nonzero.length === 0) return { visualMax: 1, breakAxis: false };
  const peak = nonzero[0]!;
  const restPeak = nonzero[1] ?? 0;
  if (restPeak > 0 && peak / restPeak >= BREAK_RATIO) {
    return { visualMax: restPeak * VISUAL_PAD, breakAxis: true };
  }
  return { visualMax: peak, breakAxis: false };
}

function barVisualPct(amount: number, visualMax: number): number {
  if (amount <= 0 || visualMax <= 0) return 0;
  return Math.min(1, amount / visualMax);
}

/** True when global break is on and this amount exceeds the compressed domain. */
function isOverlong(amount: number, visualMax: number, breakAxis: boolean): boolean {
  return breakAxis && amount > visualMax;
}

/** White diagonal double-cut for axis-break bars */
function AxisBreakCut() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <span className="absolute left-[46%] top-[-45%] h-[190%] w-[2.5px] -rotate-[28deg] bg-surface" />
      <span className="absolute left-[54%] top-[-45%] h-[190%] w-[2.5px] -rotate-[28deg] bg-surface" />
    </span>
  );
}

function cappedBarWidth(
  amount: number,
  visualMax: number,
  breakAxis: boolean,
  trackW: number,
  fillCap = 1
): { barW: number; overlong: boolean } {
  const overlong = isOverlong(amount, visualMax, breakAxis);
  const fillFloor = Math.min(MIN_FILL_PX, trackW);
  const maxFill = trackW * fillCap;
  if (overlong) {
    return {
      barW: Math.min(trackW, Math.max(maxFill, fillFloor)),
      overlong: true,
    };
  }
  const pct = barVisualPct(amount, visualMax);
  let barW = Math.max(trackW * pct, fillFloor);
  if (breakAxis && barW >= trackW * 0.98 && amount >= visualMax) {
    return {
      barW: Math.min(trackW, Math.max(maxFill, fillFloor)),
      overlong: true,
    };
  }
  barW = Math.min(barW, maxFill);
  return { barW, overlong: false };
}

function ExpenseBar({
  amount,
  visualMax,
  breakAxis,
  halfWidth,
  barColor,
  locale,
}: {
  amount: number;
  visualMax: number;
  breakAxis: boolean;
  halfWidth: number;
  barColor: string;
  locale: string;
}) {
  if (amount <= 0) {
    return (
      <div className="relative flex h-4 min-w-0 flex-1 items-center justify-end">
        <div className={`h-4 w-full rounded-l-full ${TRACK_CLASS}`} aria-hidden />
      </div>
    );
  }

  const label = formatTornadoAmount(amount, locale, '-');
  const trackW = Math.max(halfWidth, 1);
  const { barW, overlong } = cappedBarWidth(amount, visualMax, breakAxis, trackW, 1);

  return (
    <div className="relative flex h-4 min-w-0 flex-1 items-center justify-end overflow-hidden">
      <div
        className={`relative flex h-4 w-full items-center justify-end overflow-hidden rounded-l-full ${TRACK_CLASS}`}
      >
        <div
          className="relative h-4 overflow-hidden rounded-l-full"
          style={{ width: barW, backgroundColor: barColor }}
        >
          {overlong ? <AxisBreakCut /> : null}
        </div>
        <span className={`${AMOUNT_LABEL_CLASS} left-0 pl-2 text-left`}>{label}</span>
      </div>
    </div>
  );
}

function IncomeBar({
  amount,
  visualMax,
  breakAxis,
  halfWidth,
  barColor,
  locale,
}: {
  amount: number;
  visualMax: number;
  breakAxis: boolean;
  halfWidth: number;
  barColor: string;
  locale: string;
}) {
  if (amount <= 0) {
    return (
      <div className="relative flex h-4 min-w-0 flex-1 items-center justify-start">
        <div className={`h-4 w-full rounded-r-full ${TRACK_CLASS}`} aria-hidden />
      </div>
    );
  }

  const label = formatTornadoAmount(amount, locale, '+');
  const trackW = Math.max(halfWidth, 1);
  const { barW, overlong } = cappedBarWidth(amount, visualMax, breakAxis, trackW, 1);

  return (
    <div className="relative flex h-4 min-w-0 flex-1 items-center justify-start overflow-hidden">
      <div
        className={`relative flex h-4 w-full items-center justify-start overflow-hidden rounded-r-full ${TRACK_CLASS}`}
      >
        <div
          className="relative h-4 overflow-hidden rounded-r-full"
          style={{ width: Math.max(MIN_FILL_PX, barW), backgroundColor: barColor }}
        >
          {overlong ? <AxisBreakCut /> : null}
        </div>
        <span className={`${AMOUNT_LABEL_CLASS} right-0 pr-2 text-right`}>{label}</span>
      </div>
    </div>
  );
}

export function HomeHotContactTornado({ contacts }: { contacts: HomeRankingContact[] }) {
  const { t } = useTranslation();
  const { scheme, locale } = useSettings();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(140);
  const [rightWidth, setRightWidth] = useState(120);

  const rows = useMemo(() => {
    return contacts.map(sumContact).filter((r) => r.income > 0 || r.expense > 0);
  }, [contacts]);

  const { visualMax, breakAxis } = useMemo(() => {
    const amounts: number[] = [];
    for (const r of rows) {
      if (r.income > 0) amounts.push(r.income);
      if (r.expense > 0) amounts.push(r.expense);
    }
    return computeVisualMax(amounts);
  }, [rows]);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left && !right) return;
    const update = () => {
      if (left) setLeftWidth(Math.max(40, Math.floor(left.clientWidth)));
      if (right) setRightWidth(Math.max(40, Math.floor(right.clientWidth)));
    };
    update();
    const ro = new ResizeObserver(update);
    if (left) ro.observe(left);
    if (right) ro.observe(right);
    return () => ro.disconnect();
  }, [rows.length]);

  const expenseColor = chartStrokeForType('expense', scheme);
  const incomeColor = chartStrokeForType('income', scheme);

  if (rows.length === 0) return null;

  return (
    <div className="border-t border-line/60">
      <div className="px-4 pt-3 pb-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {t('home.hotContacts')}
        </p>
      </div>
      <div className="px-3 pb-3.5 space-y-2.5">
        {rows.map((row, i) => (
          <div key={row.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-0">
            <div ref={i === 0 ? leftRef : undefined} className="min-w-0">
              <ExpenseBar
                amount={row.expense}
                visualMax={visualMax}
                breakAxis={breakAxis}
                halfWidth={leftWidth}
                barColor={expenseColor}
                locale={locale}
              />
            </div>
            <div className={NAME_COL_CLASS}>
              <span
                className={`inline-flex h-4 shrink-0 items-center justify-center px-1 text-[11px] leading-none text-ink ${
                  i === 0 ? 'font-semibold' : 'font-medium'
                }`}
                title={`${row.name}${t('home.hotTagUseCount', { count: row.useCount })}`}
              >
                <span className="max-w-[6rem] shrink-0 truncate whitespace-nowrap">{row.name}</span>
                <span className="shrink-0 font-normal tabular-nums text-muted">
                  {t('home.hotTagUseCount', { count: row.useCount })}
                </span>
              </span>
            </div>
            <div ref={i === 0 ? rightRef : undefined} className="min-w-0">
              <IncomeBar
                amount={row.income}
                visualMax={visualMax}
                breakAxis={breakAxis}
                halfWidth={rightWidth}
                barColor={incomeColor}
                locale={locale}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
