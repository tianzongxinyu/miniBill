'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/components/SettingsProvider';
import type { HomeRankingTag } from '@/lib/api';
import { chartStrokeForType, textClassForSign } from '@/lib/amountColors';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

const BAR_FILL_OPACITY = 0.65;
const BREAK_RATIO = 2;
const VISUAL_PAD = 1.2;
/** Overlong (broken-axis) bars fill most of the track, not 100%, so the cut is readable. */
const OVERLONG_FILL = 0.92;
const AMOUNT_COL_MIN_PX = 56;
const AMOUNT_COL_MAX_PX = 120;

function formatIntAmount(cents: number, locale: string, sign: '+' | '-' | ''): string {
  const body = new Intl.NumberFormat(toIntlLocale(locale), {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(cents) / 100));
  return sign ? `${sign}${body}` : body;
}

function formatNet(cents: number, locale: string): string {
  if (cents === 0) return formatIntAmount(0, locale, '');
  return formatIntAmount(cents, locale, cents > 0 ? '+' : '-');
}

function formatIncomeExpenseLabel(income: number, expense: number, locale: string): string {
  return `${formatIntAmount(income, locale, '+')} / ${formatIntAmount(expense, locale, '-')}`;
}

function resolveAmountColWidth(labels: string[]): number {
  let max = AMOUNT_COL_MIN_PX;
  for (const label of labels) {
    max = Math.max(max, Math.ceil(label.length * 7.2) + 4);
  }
  return Math.min(max, AMOUNT_COL_MAX_PX);
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

function AxisBreakCut() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <span className="absolute left-[46%] top-[-45%] h-[190%] w-[2.5px] -rotate-[28deg] bg-surface" />
      <span className="absolute left-[54%] top-[-45%] h-[190%] w-[2.5px] -rotate-[28deg] bg-surface" />
    </span>
  );
}

function ProportionalDualBar({
  income,
  expense,
  visualMax,
  breakAxis,
  incomeColor,
  expenseColor,
}: {
  income: number;
  expense: number;
  visualMax: number;
  breakAxis: boolean;
  incomeColor: string;
  expenseColor: string;
}) {
  const total = income + expense;
  if (total <= 0 || visualMax <= 0) {
    return <div className="h-1.5 w-full rounded-full bg-line/25" />;
  }

  const overlong = breakAxis && total > visualMax;
  const fillPct = overlong
    ? OVERLONG_FILL * 100
    : Math.min(100, (total / visualMax) * 100);
  const expensePct = (expense / total) * 100;
  const incomePct = (income / total) * 100;

  return (
    <div className="h-1.5 w-full rounded-full bg-line/25">
      <div
        className="relative flex h-full min-w-[2px] overflow-hidden rounded-full"
        style={{ width: `${Math.max(fillPct, total > 0 ? 4 : 0)}%` }}
      >
        {expense > 0 ? (
          <div
            className="h-full min-w-[2px]"
            style={{
              width: `${expensePct}%`,
              backgroundColor: expenseColor,
              opacity: BAR_FILL_OPACITY,
            }}
          />
        ) : null}
        {income > 0 ? (
          <div
            className="h-full min-w-[2px]"
            style={{
              width: `${incomePct}%`,
              backgroundColor: incomeColor,
              opacity: BAR_FILL_OPACITY,
            }}
          />
        ) : null}
        {overlong ? <AxisBreakCut /> : null}
      </div>
    </div>
  );
}

export function HomeHotTagCapsules({ tags }: { tags: HomeRankingTag[] }) {
  const { t } = useTranslation();
  const { scheme, locale } = useSettings();
  const expenseColor = chartStrokeForType('expense', scheme);
  const incomeColor = chartStrokeForType('income', scheme);

  const { visualMax, breakAxis } = useMemo(() => {
    const totals = tags.map((tag) => (tag.total_income ?? 0) + (tag.total_expense ?? 0));
    return computeVisualMax(totals);
  }, [tags]);

  const amountColWidth = useMemo(() => {
    const labels = tags.map((tag) =>
      formatIncomeExpenseLabel(tag.total_income ?? 0, tag.total_expense ?? 0, locale)
    );
    return resolveAmountColWidth(labels);
  }, [tags, locale]);

  if (tags.length === 0) return null;

  return (
    <div className="border-t border-line/40">
      <div className="px-4 pt-2.5 pb-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {t('home.hotTags')}
        </p>
      </div>
      <ul className="divide-y divide-line/40 px-3 pb-3">
        {tags.map((tag) => {
          const income = tag.total_income ?? 0;
          const expense = tag.total_expense ?? 0;
          const net = income - expense;
          const netClass =
            net === 0 ? 'text-muted' : textClassForSign(net, scheme);

          return (
            <li key={tag.id} className="min-w-0 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
                  style={{ backgroundColor: tag.color_bg || '#3E8E7E' }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                  {tag.name}
                  <span className="ml-0.5 font-normal tabular-nums text-muted">
                    {t('home.hotTagUseCount', { count: tag.use_count })}
                  </span>
                </span>
                <span className={`amount-num shrink-0 text-[11px] font-medium tabular-nums ${netClass}`}>
                  {formatNet(net, locale)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ProportionalDualBar
                    income={income}
                    expense={expense}
                    visualMax={visualMax}
                    breakAxis={breakAxis}
                    incomeColor={incomeColor}
                    expenseColor={expenseColor}
                  />
                </div>
                <p
                  className="shrink-0 text-right text-[10px] tabular-nums text-muted leading-none"
                  style={{ width: amountColWidth }}
                >
                  {formatIncomeExpenseLabel(income, expense, locale)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
