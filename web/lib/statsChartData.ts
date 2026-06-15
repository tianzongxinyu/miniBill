import { totalExpenseCents } from '@/lib/totalExpense';
import type { MonthSeriesPoint, YearSeriesPoint } from '@/lib/api';

export type StatsChartRow = {
  key: string;
  shortLabel: string;
  yearLabel: string;
  year: number;
  month?: number;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  balanceCents: number | null;
};

export type StatsSeriesKey = 'income' | 'expense' | 'net' | 'balance';

/** 余额序列在右轴上最多占据的比例（顶部留白） */
export const BALANCE_AXIS_FILL = 0.8;

/** 收入/支出/净收入在左轴上最多占据的比例（顶部留白） */
export const LEFT_AXIS_FILL = 0.7;

export function isSeriesVisible(hiddenSeries: Set<string>, key: StatsSeriesKey) {
  return !hiddenSeries.has(key);
}

export function monthShortLabel(year: number, month: number) {
  const yy = year % 100;
  return `${yy}/${month}`;
}

function toYuan(cents: number) {
  return cents / 100;
}

export function buildStatsChartRows(
  mode: 'month' | 'year',
  monthItems: MonthSeriesPoint[],
  yearItems: YearSeriesPoint[],
  searchActive: boolean
): StatsChartRow[] {
  if (mode === 'month') {
    return monthItems.map((m) => {
      const expenseCents = searchActive
        ? m.total_expense
        : totalExpenseCents(m.total_expense, m.daily_expense);
      return {
        key: `${m.year}-${String(m.month).padStart(2, '0')}`,
        shortLabel: monthShortLabel(m.year, m.month),
        yearLabel: String(m.year),
        year: m.year,
        month: m.month,
        incomeCents: m.total_income,
        expenseCents,
        netCents: m.total_income - expenseCents,
        balanceCents: searchActive ? null : (m.registered_balance ?? null),
      };
    });
  }
  return yearItems.map((y) => ({
    key: String(y.year),
    shortLabel: String(y.year),
    yearLabel: '',
    year: y.year,
    incomeCents: y.total_income,
    expenseCents: y.total_expense,
    netCents: y.total_income - y.total_expense,
    balanceCents: searchActive ? null : (y.end_balance ?? null),
  }));
}

export function chartRowToSeries(row: StatsChartRow) {
  return {
    name: row.shortLabel,
    expense: toYuan(row.expenseCents),
    income: toYuan(row.incomeCents),
    net: toYuan(row.netCents),
    balance: row.balanceCents != null ? toYuan(row.balanceCents) : null,
  };
}

export function leftAxisDomain(rows: StatsChartRow[], hiddenSeries: Set<string>, searchActive: boolean) {
  let min = 0;
  let max = 0;
  let hasData = false;
  for (const row of rows) {
    const points: number[] = [];
    if (!hiddenSeries.has('expense')) points.push(row.expenseCents);
    if (!hiddenSeries.has('income')) points.push(row.incomeCents);
    if (!searchActive && !hiddenSeries.has('net')) points.push(row.netCents);
    for (const cents of points) {
      hasData = true;
      const yuan = cents / 100;
      min = Math.min(min, yuan);
      max = Math.max(max, yuan);
    }
  }
  if (!hasData) {
    return [0, 2] as [number, number];
  }
  if (min === max) {
    const dataMin = Math.min(0, min);
    const dataMax = Math.max(min, max, dataMin + 1);
    const span = dataMax - dataMin;
    return [dataMin, dataMin + span / LEFT_AXIS_FILL] as [number, number];
  }
  const dataMin = Math.min(0, min);
  const dataMax = max;
  const span = dataMax - dataMin;
  if (span <= 0) {
    return [dataMin, dataMin + 1] as [number, number];
  }
  // 收入/支出/净收入最高约占左轴 70% 高度，顶部留空
  return [dataMin, dataMin + span / LEFT_AXIS_FILL] as [number, number];
}

export function rightAxisDomain(
  rows: StatsChartRow[],
  hiddenSeries: Set<string>,
  searchActive: boolean
): [number, number] {
  if (searchActive || hiddenSeries.has('balance')) {
    return [0, 1];
  }
  let min = 0;
  let max = 0;
  let hasData = false;
  for (const row of rows) {
    if (row.balanceCents == null) continue;
    hasData = true;
    const yuan = row.balanceCents / 100;
    min = Math.min(min, yuan);
    max = Math.max(max, yuan);
  }
  if (!hasData) {
    return [0, 1] as [number, number];
  }
  if (min === max) {
    const dataMin = Math.min(0, min);
    const dataMax = Math.max(min, max, dataMin + 1);
    const span = dataMax - dataMin;
    return [dataMin, dataMin + span / BALANCE_AXIS_FILL] as [number, number];
  }
  const dataMin = Math.min(0, min);
  const dataMax = max;
  const span = dataMax - dataMin;
  if (span <= 0) {
    return [dataMin, dataMin + 1] as [number, number];
  }
  // 余额曲线最高约占右轴 80% 高度，顶部留空
  return [dataMin, dataMin + span / BALANCE_AXIS_FILL] as [number, number];
}

export function axisTickValues(domain: [number, number], count = 4): number[] {
  const [min, max] = domain;
  if (count <= 1) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const v = min + step * i;
    return Math.round(v * 100) / 100;
  });
}
