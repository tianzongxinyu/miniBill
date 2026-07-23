'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/components/SettingsProvider';
import type { HomeRankingContact } from '@/lib/api';
import { chartStrokeForType, textClassForType } from '@/lib/amountColors';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

const BREAK_RATIO = 2;
const VISUAL_PAD = 1.2;
const RIGHT_AMOUNT_COL_MIN_PX = 40; // ~2.5rem
const RIGHT_BAR_GAP_PX = 8;
const BAR_PAD_X = 8;
const NAME_COL_CLASS = 'w-[5.75rem] shrink-0 px-0 text-center';
const RANK_BG_ALPHAS = [0.28, 0.22, 0.16, 0.11, 0.07] as const;

function rankBg(rankIndex: number): string {
  const alpha = RANK_BG_ALPHAS[Math.min(rankIndex, RANK_BG_ALPHAS.length - 1)] ?? 0.07;
  return `rgba(62,142,126,${alpha})`;
}

type TornadoRow = {
  id: number;
  name: string;
  useCount: number;
  income: number;
  expense: number;
};

function formatTornadoAmount(cents: number, locale: string, sign: '+' | '-'): string {
  const body = new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(cents) / 100));
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

function measureLabelWidth(label: string): number {
  return Math.ceil(label.length * 7.2) + BAR_PAD_X * 2;
}

/** Outer amount column: tighter pad than in-bar labels. */
function measureAmountColWidth(label: string): number {
  return Math.ceil(label.length * 7.2) + 4;
}

function resolveAmountColWidth(labels: string[], halfWidth: number): number {
  let max = RIGHT_AMOUNT_COL_MIN_PX;
  for (const label of labels) {
    max = Math.max(max, measureAmountColWidth(label));
  }
  const cap = Math.max(RIGHT_AMOUNT_COL_MIN_PX, Math.floor(halfWidth * 0.45));
  return Math.min(max, cap);
}

function cappedBarWidth(
  amount: number,
  visualMax: number,
  breakAxis: boolean,
  trackW: number,
  labelMinW: number,
  fillCap = 1
): { barW: number; overlong: boolean } {
  const overlong = isOverlong(amount, visualMax, breakAxis);
  const labelFloor = Math.min(labelMinW, trackW);
  const maxFill = trackW * fillCap;
  if (overlong) {
    return {
      barW: Math.min(trackW, Math.max(maxFill, labelFloor)),
      overlong: true,
    };
  }
  const pct = barVisualPct(amount, visualMax);
  let barW = Math.max(trackW * pct, labelFloor);
  // Label push fills the track → treat as overlong when break domain is active
  if (breakAxis && barW >= trackW * 0.98 && amount >= visualMax) {
    return {
      barW: Math.min(trackW, Math.max(maxFill, labelFloor)),
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
      <div className="relative flex h-5 min-w-0 flex-1 items-center justify-end">
        <div className="h-4 w-full rounded-l-full bg-line/25" aria-hidden />
      </div>
    );
  }

  const label = formatTornadoAmount(amount, locale, '-');
  const trackW = Math.max(halfWidth, 1);
  const { barW, overlong } = cappedBarWidth(
    amount,
    visualMax,
    breakAxis,
    trackW,
    measureLabelWidth(label),
    1
  );

  return (
    <div className="relative flex h-5 min-w-0 flex-1 items-center justify-end overflow-hidden">
      <div className="relative flex h-4 w-full items-center justify-end overflow-hidden rounded-l-full bg-line/25">
        <div
          className="relative flex h-full items-center justify-end overflow-hidden rounded-l-full px-2"
          style={{ width: barW, backgroundColor: barColor }}
        >
          {overlong ? <AxisBreakCut /> : null}
          <span className="amount-num relative z-[1] shrink-0 text-right text-[11px] tabular-nums leading-none text-white drop-shadow-[0_0.5px_0_rgba(0,0,0,0.18)]">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

function IncomeBar({
  amount,
  visualMax,
  breakAxis,
  halfWidth,
  amountColWidth,
  barColor,
  labelClass,
  locale,
}: {
  amount: number;
  visualMax: number;
  breakAxis: boolean;
  halfWidth: number;
  amountColWidth: number;
  barColor: string;
  labelClass: string;
  locale: string;
}) {
  const barTrackW = Math.max(0, halfWidth - amountColWidth - RIGHT_BAR_GAP_PX);

  if (amount <= 0) {
    return (
      <div className="flex h-5 min-w-0 flex-1 items-center" style={{ gap: RIGHT_BAR_GAP_PX }}>
        <div className="flex min-w-0 flex-1 items-center justify-start">
          <div className="h-4 w-full rounded-r-full bg-line/25" aria-hidden />
        </div>
        <div
          className="shrink-0 text-right text-[11px] tabular-nums leading-none"
          style={{ width: amountColWidth }}
        />
      </div>
    );
  }

  const label = formatTornadoAmount(amount, locale, '+');
  const { barW, overlong } = cappedBarWidth(amount, visualMax, breakAxis, barTrackW, 4, 1);

  return (
    <div className="flex h-5 min-w-0 flex-1 items-center" style={{ gap: RIGHT_BAR_GAP_PX }}>
      <div className="flex min-w-0 flex-1 items-center justify-start overflow-hidden">
        <div className="relative h-4 w-full overflow-hidden rounded-r-full bg-line/25">
          <div
            className="relative h-full overflow-hidden rounded-r-full"
            style={{ width: Math.max(4, barW), backgroundColor: barColor }}
          >
            {overlong ? <AxisBreakCut /> : null}
          </div>
        </div>
      </div>
      <span
        className={`amount-num shrink-0 text-right text-[11px] tabular-nums leading-none ${labelClass}`}
        style={{ width: amountColWidth }}
      >
        {label}
      </span>
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

  const amountColWidth = useMemo(() => {
    const labels: string[] = [];
    for (const r of rows) {
      if (r.income > 0) labels.push(formatTornadoAmount(r.income, locale, '+'));
    }
    return resolveAmountColWidth(labels, rightWidth);
  }, [rows, locale, rightWidth]);

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
  const incomeLabel = textClassForType('income', scheme);

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
          <div key={row.id} className="grid grid-cols-[0.9fr_auto_1.1fr] items-center gap-x-0">
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
                className={`inline-flex h-4 w-full items-center justify-center truncate px-0.5 text-[11px] leading-none text-ink ${
                  i === 0 ? 'font-semibold' : 'font-medium'
                }`}
                style={{ backgroundColor: rankBg(i) }}
                title={`${row.name}${t('home.hotTagUseCount', { count: row.useCount })}`}
              >
                <span className="truncate">{row.name}</span>
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
                amountColWidth={amountColWidth}
                barColor={incomeColor}
                labelClass={incomeLabel}
                locale={locale}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
