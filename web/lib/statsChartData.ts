import { totalExpenseCents } from '@/lib/totalExpense';
import {
  getCurrentYearMonth,
  prevMonth,
  type MonthSeriesPoint,
  type YearSeriesPoint,
} from '@/lib/api';

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

function isCurrentMonth(year: number, month: number): boolean {
  const now = getCurrentYearMonth();
  return year === now.year && month === now.month;
}

function isCurrentYear(year: number): boolean {
  return year === getCurrentYearMonth().year;
}

/** 当月/当年：上月（或上年末）登记余额 + 收支扎差；历史月份用登记余额 */
function balanceCentsForMonth(
  m: MonthSeriesPoint,
  netCents: number,
  searchActive: boolean,
  prevRegisteredBalance?: number | null
): number | null {
  if (searchActive) return null;
  if (!isCurrentMonth(m.year, m.month)) return m.registered_balance ?? null;
  const start = m.start_balance ?? prevRegisteredBalance ?? null;
  return start != null ? start + netCents : netCents;
}

function balanceCentsForYear(y: YearSeriesPoint, netCents: number, searchActive: boolean): number | null {
  if (searchActive) return null;
  if (!isCurrentYear(y.year)) return y.end_balance ?? null;
  const start = y.start_balance ?? null;
  return start != null ? start + netCents : netCents;
}

function registeredBalanceByMonth(items: MonthSeriesPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of items) {
    if (m.registered_balance != null) {
      map.set(`${m.year}-${m.month}`, m.registered_balance);
    }
  }
  return map;
}

export function buildStatsChartRows(
  mode: 'month' | 'year',
  monthItems: MonthSeriesPoint[],
  yearItems: YearSeriesPoint[],
  searchActive: boolean
): StatsChartRow[] {
  if (mode === 'month') {
    const registeredByMonth = registeredBalanceByMonth(monthItems);
    return monthItems.map((m) => {
      const expenseCents = searchActive
        ? m.total_expense
        : totalExpenseCents(m.total_expense, m.daily_expense);
      const netCents = m.total_income - expenseCents;
      const prev = prevMonth(m.year, m.month);
      const prevRegistered = registeredByMonth.get(`${prev.year}-${prev.month}`);
      return {
        key: `${m.year}-${String(m.month).padStart(2, '0')}`,
        shortLabel: monthShortLabel(m.year, m.month),
        yearLabel: String(m.year),
        year: m.year,
        month: m.month,
        incomeCents: m.total_income,
        expenseCents,
        netCents,
        balanceCents: balanceCentsForMonth(m, netCents, searchActive, prevRegistered),
      };
    });
  }
  return yearItems.map((y) => {
    const netCents = y.total_income - y.total_expense;
    return {
      key: String(y.year),
      shortLabel: String(y.year),
      yearLabel: '',
      year: y.year,
      incomeCents: y.total_income,
      expenseCents: y.total_expense,
      netCents,
      balanceCents: balanceCentsForYear(y, netCents, searchActive),
    };
  });
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

type DataRange = { min: number; max: number };

function collectLeftRange(
  rows: StatsChartRow[],
  hiddenSeries: Set<string>,
  searchActive: boolean
): DataRange | null {
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
  return hasData ? { min, max } : null;
}

function collectBalanceRange(
  rows: StatsChartRow[],
  hiddenSeries: Set<string>,
  searchActive: boolean
): DataRange | null {
  if (searchActive || hiddenSeries.has('balance')) return null;
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
  return hasData ? { min, max } : null;
}

/** 使 0 刻度线在双轴上处于相同高度比例（below / (below + above)） */
function minZeroRatio(dataMin: number, dataMax: number, fill: number): number {
  const dMin = Math.min(0, dataMin);
  const dMax = Math.max(dataMax, 0);
  if (dMin >= 0) return 0;
  const below = -dMin;
  const above = dMax / fill;
  if (below + above <= 0) return 0;
  return below / (below + above);
}

function domainWithSharedZero(
  rawMin: number,
  rawMax: number,
  fill: number,
  zeroRatio: number
): [number, number] {
  const dataMin = Math.min(0, rawMin);
  const dataMax = Math.max(rawMax, 0);

  if (zeroRatio <= 0) {
    const top = Math.max(dataMax / fill, 1);
    return [0, top];
  }

  const belowNeed = -dataMin;
  const aboveNeed = Math.max(dataMax / fill, 0);
  const heightFromBelow = belowNeed / zeroRatio;
  const heightFromAbove = aboveNeed / (1 - zeroRatio);
  const height = Math.max(heightFromBelow, heightFromAbove, 1);

  return [-zeroRatio * height, (1 - zeroRatio) * height];
}

function domainFromRange(range: DataRange, fill: number): [number, number] {
  const { min, max } = range;
  if (min === max) {
    const dataMin = Math.min(0, min);
    const dataMax = Math.max(min, max, dataMin + 1);
    const span = dataMax - dataMin;
    return [dataMin, dataMin + span / fill];
  }
  const dataMin = Math.min(0, min);
  const span = max - dataMin;
  if (span <= 0) {
    return [dataMin, dataMin + 1];
  }
  return [dataMin, dataMin + span / fill];
}

export function chartAxisDomains(
  rows: StatsChartRow[],
  hiddenSeries: Set<string>,
  searchActive: boolean
): { left: [number, number]; right: [number, number] } {
  const leftRange = collectLeftRange(rows, hiddenSeries, searchActive);
  const balanceRange = collectBalanceRange(rows, hiddenSeries, searchActive);

  if (searchActive || hiddenSeries.has('balance') || !balanceRange) {
    return {
      left: leftRange ? domainFromRange(leftRange, LEFT_AXIS_FILL) : ([0, 2] as [number, number]),
      right: [0, 1],
    };
  }

  const zeroRatio = Math.max(
    leftRange ? minZeroRatio(leftRange.min, leftRange.max, LEFT_AXIS_FILL) : 0,
    minZeroRatio(balanceRange.min, balanceRange.max, BALANCE_AXIS_FILL)
  );

  return {
    left: leftRange
      ? domainWithSharedZero(leftRange.min, leftRange.max, LEFT_AXIS_FILL, zeroRatio)
      : ([0, 2] as [number, number]),
    right: domainWithSharedZero(balanceRange.min, balanceRange.max, BALANCE_AXIS_FILL, zeroRatio),
  };
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
