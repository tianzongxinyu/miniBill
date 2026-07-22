'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/components/SettingsProvider';
import type { HomeRankingTag } from '@/lib/api';
import { chartStrokeForType, textClassForSign, textClassForType } from '@/lib/amountColors';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

type TagFilter = 'all' | 'expense' | 'income';

type TagRow = {
  id: number;
  name: string;
  colorBg: string;
  income: number;
  expense: number;
};

const BAR_FILL_OPACITY = 0.65;

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

function sumTag(tag: HomeRankingTag): TagRow {
  let income = 0;
  let expense = 0;
  for (const p of tag.points ?? []) {
    income += p.total_income ?? 0;
    expense += p.total_expense ?? 0;
  }
  return {
    id: tag.id,
    name: tag.name,
    colorBg: tag.color_bg || '#3E8E7E',
    income,
    expense,
  };
}

const FILTERS: TagFilter[] = ['all', 'expense', 'income'];

function DualRatioBar({
  income,
  expense,
  incomeColor,
  expenseColor,
}: {
  income: number;
  expense: number;
  incomeColor: string;
  expenseColor: string;
}) {
  const total = income + expense;
  if (total <= 0) {
    return <div className="h-1 w-full rounded-full bg-line/25" />;
  }
  const expensePct = (expense / total) * 100;
  const incomePct = (income / total) * 100;
  return (
    <div className="flex h-1 w-full overflow-hidden rounded-full bg-line/25">
      {expense > 0 ? (
        <div
          className="h-full min-w-[2px]"
          style={{ width: `${expensePct}%`, backgroundColor: expenseColor, opacity: BAR_FILL_OPACITY }}
        />
      ) : null}
      {income > 0 ? (
        <div
          className="h-full min-w-[2px]"
          style={{ width: `${incomePct}%`, backgroundColor: incomeColor, opacity: BAR_FILL_OPACITY }}
        />
      ) : null}
    </div>
  );
}

function MonoBar({
  amount,
  max,
  color,
}: {
  amount: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (amount / max) * 100) : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line/25">
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${Math.max(pct, amount > 0 ? 4 : 0)}%`,
          backgroundColor: color,
          opacity: BAR_FILL_OPACITY,
        }}
      />
    </div>
  );
}

export function HomeHotTagCapsules({ tags }: { tags: HomeRankingTag[] }) {
  const { t } = useTranslation();
  const { scheme, locale } = useSettings();
  const [filter, setFilter] = useState<TagFilter>('all');

  const rows = useMemo(() => {
    return tags.map(sumTag).filter((r) => r.income > 0 || r.expense > 0);
  }, [tags]);

  const visible = useMemo(() => {
    if (filter === 'all') {
      return [...rows].sort((a, b) => b.income + b.expense - (a.income + a.expense));
    }
    if (filter === 'expense') {
      return rows
        .filter((r) => r.expense > 0)
        .sort((a, b) => b.expense - a.expense);
    }
    return rows
      .filter((r) => r.income > 0)
      .sort((a, b) => b.income - a.income);
  }, [rows, filter]);

  const monoMax = useMemo(() => {
    if (filter === 'expense') return Math.max(0, ...visible.map((r) => r.expense));
    if (filter === 'income') return Math.max(0, ...visible.map((r) => r.income));
    return 0;
  }, [filter, visible]);

  const expenseColor = chartStrokeForType('expense', scheme);
  const incomeColor = chartStrokeForType('income', scheme);
  const segIndex = FILTERS.indexOf(filter);

  const segLabels: Record<TagFilter, string> = {
    all: t('home.hotTagAll'),
    expense: t('home.hotTagExpense'),
    income: t('home.hotTagIncome'),
  };

  if (rows.length === 0) return null;

  return (
    <div className="border-t border-line/40">
      <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted shrink-0">
          {t('home.hotTags')}
        </p>
        <div
          className="relative grid grid-cols-3 rounded-full border border-line/50 bg-accent-soft/40 p-0.5 backdrop-blur-sm"
          role="tablist"
          aria-label={t('home.hotTags')}
        >
          <span
            className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full bg-surface/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${segIndex * 100}%)` }}
            aria-hidden
          />
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`relative z-[1] px-2 py-0.5 text-[10px] font-medium tabular-nums transition-colors duration-200 ${
                filter === key ? 'text-ink' : 'text-muted/70'
              }`}
              onClick={() => setFilter(key)}
            >
              {segLabels[key]}
            </button>
          ))}
        </div>
      </div>

      <ul className="px-3 pb-3 space-y-2">
        {visible.map((row) => {
          const net = row.income - row.expense;
          const mainCents =
            filter === 'all' ? net : filter === 'expense' ? row.expense : row.income;
          const mainLabel =
            filter === 'all'
              ? formatNet(net, locale)
              : filter === 'expense'
                ? formatIntAmount(row.expense, locale, '-')
                : formatIntAmount(row.income, locale, '+');
          const mainClass =
            filter === 'all'
              ? net === 0
                ? 'text-muted'
                : textClassForSign(net, scheme)
              : filter === 'expense'
                ? textClassForType('expense', scheme)
                : textClassForType('income', scheme);

          return (
            <li key={row.id} className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
                  style={{ backgroundColor: row.colorBg }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                  {row.name}
                </span>
                <span className={`amount-num shrink-0 text-[11px] font-medium tabular-nums ${mainClass}`}>
                  {mainLabel}
                </span>
              </div>
              {filter === 'all' ? (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <DualRatioBar
                      income={row.income}
                      expense={row.expense}
                      incomeColor={incomeColor}
                      expenseColor={expenseColor}
                    />
                  </div>
                  <p className="shrink-0 text-[10px] tabular-nums text-muted leading-none">
                    {formatIntAmount(row.income, locale, '+')}
                    {' / '}
                    {formatIntAmount(row.expense, locale, '-')}
                  </p>
                </div>
              ) : (
                <MonoBar
                  amount={mainCents}
                  max={monoMax}
                  color={filter === 'expense' ? expenseColor : incomeColor}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
