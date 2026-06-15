'use client';

import { useCallback, useId, useMemo } from 'react';
import { useSettings } from '@/components/SettingsProvider';
import {
  amountClassForSign,
  amountClassForType,
  BALANCE_CHART_FILL_BOTTOM,
  BALANCE_CHART_FILL_TOP,
  BALANCE_CHART_STROKE,
  chartStrokeForType,
  NET_INCOME_CHART_FILL_BOTTOM,
  NET_INCOME_CHART_FILL_TOP,
  NET_INCOME_CHART_STROKE,
  type AmountColorScheme,
} from '@/lib/amountColors';
import {
  formatBalanceMoney,
  formatSignedMoney,
  formatTypedMoney,
} from '@/lib/formatMoney';
import {
  axisTickValues,
  buildStatsChartRows,
  chartRowToSeries,
  leftAxisDomain,
  rightAxisDomain,
  type StatsChartRow,
} from '@/lib/statsChartData';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { MonthSeriesPoint, YearSeriesPoint } from '@/lib/api';

type StatsScrollChartProps = {
  mode: 'month' | 'year';
  monthItems: MonthSeriesPoint[];
  yearItems: YearSeriesPoint[];
  searchActive: boolean;
  loading: boolean;
  pointWidth: number;
  rows: StatsChartRow[];
  hiddenSeries: Set<string>;
  height?: number;
};

const SERIES_LABELS: Record<string, string> = {
  expense: '总支出',
  income: '总收入',
  net: '净收入',
  balance: '余额',
};

function formatTooltipValue(dataKey: string, yuan: number, scheme: AmountColorScheme) {
  const cents = Math.round(yuan * 100);
  switch (dataKey) {
    case 'income':
      return { text: formatTypedMoney(cents, 'income'), className: amountClassForType('income', scheme) };
    case 'expense':
      return { text: formatTypedMoney(cents, 'expense'), className: amountClassForType('expense', scheme) };
    case 'net':
      return { text: formatSignedMoney(cents), className: amountClassForSign(cents, scheme) };
    case 'balance':
      return { text: formatBalanceMoney(cents), className: 'text-ink font-medium' };
    default:
      return { text: formatSignedMoney(cents), className: 'text-ink' };
  }
}

type TooltipPayload = ReadonlyArray<{
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}>;

function StatsChartTooltip({
  active,
  payload,
  label,
  scheme,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string | number;
  scheme: AmountColorScheme;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-line/80 bg-surface px-3 py-2 text-xs shadow-panel">
      <p className="text-muted mb-1.5">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? '');
          const yuan = Number(entry.value ?? 0);
          const { text, className } = formatTooltipValue(key, yuan, scheme);
          return (
            <li key={key} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="text-muted">{SERIES_LABELS[key] ?? key}</span>
              <span className={className}>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StatsScrollChart({
  mode,
  monthItems,
  yearItems,
  searchActive,
  loading,
  pointWidth,
  rows: rowsProp,
  hiddenSeries,
  height = 252,
}: StatsScrollChartProps) {
  const { scheme } = useSettings();
  const balanceGradientId = useId().replace(/:/g, '');
  const netGradientId = useId().replace(/:/g, '');
  const incomeStroke = chartStrokeForType('income', scheme);
  const expenseStroke = chartStrokeForType('expense', scheme);

  const rows = useMemo(
    () =>
      rowsProp.length > 0
        ? rowsProp
        : buildStatsChartRows(mode, monthItems, yearItems, searchActive),
    [rowsProp, mode, monthItems, yearItems, searchActive]
  );

  const chartData = useMemo(() => rows.map(chartRowToSeries), [rows]);
  const chartWidth = Math.max(chartData.length * pointWidth, 320);
  const halfPoint = pointWidth / 2;
  const yDomain = useMemo(
    () => leftAxisDomain(rows, hiddenSeries, searchActive),
    [rows, hiddenSeries, searchActive]
  );
  const yTicks = useMemo(() => axisTickValues(yDomain, 4), [yDomain]);
  const rightDomain = useMemo(
    () => rightAxisDomain(rows, hiddenSeries, searchActive),
    [rows, hiddenSeries, searchActive]
  );
  const rightTicks = useMemo(() => axisTickValues(rightDomain, 4), [rightDomain]);

  const renderTooltip = useCallback(
    (props: { active?: boolean; payload?: TooltipPayload; label?: string | number }) => (
      <StatsChartTooltip
        active={props.active}
        payload={props.payload}
        label={props.label}
        scheme={scheme}
      />
    ),
    [scheme]
  );

  const axisTickLine = { stroke: '#e8eeec' };

  if (loading && chartData.length === 0) {
    return (
      <div
        style={{ width: chartWidth, height }}
        className="flex items-center justify-center text-sm text-muted"
      >
        加载中…
      </div>
    );
  }

  return (
    <ComposedChart
      width={chartWidth}
      height={height}
      data={chartData}
      margin={{ top: 8, right: 8, left: 16, bottom: 8 }}
    >
      <defs>
        <linearGradient id={netGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NET_INCOME_CHART_FILL_TOP} />
          <stop offset="100%" stopColor={NET_INCOME_CHART_FILL_BOTTOM} />
        </linearGradient>
        <linearGradient id={balanceGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BALANCE_CHART_FILL_TOP} />
          <stop offset="100%" stopColor={BALANCE_CHART_FILL_BOTTOM} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="#e8eeec" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="name"
        type="category"
        scale="point"
        interval="preserveStartEnd"
        tick={{ fill: '#8a9390', fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        padding={{ left: halfPoint, right: halfPoint }}
      />
      <YAxis
        yAxisId="left"
        orientation="left"
        domain={yDomain}
        ticks={yTicks}
        tick={false}
        axisLine={false}
        tickLine={axisTickLine}
        width={8}
      />
      {!searchActive && (
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={rightDomain}
          ticks={rightTicks}
          tick={false}
          axisLine={false}
          tickLine={axisTickLine}
          width={8}
        />
      )}
      <ReferenceLine
        y={0}
        yAxisId="left"
        stroke="#e8eeec"
        strokeWidth={1}
        strokeDasharray="4 4"
        ifOverflow="extendDomain"
      />
      <Tooltip content={renderTooltip} />
      {!searchActive && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="net"
          stroke={NET_INCOME_CHART_STROKE}
          strokeWidth={1.5}
          fill={`url(#${netGradientId})`}
          dot={false}
          activeDot={false}
          name="净收入"
          hide={hiddenSeries.has('net')}
          isAnimationActive={false}
        />
      )}
      <Line
        yAxisId="left"
        type="monotone"
        dataKey="expense"
        stroke={expenseStroke}
        strokeWidth={1}
        dot={false}
        activeDot={false}
        name="总支出"
        hide={hiddenSeries.has('expense')}
        isAnimationActive={false}
      />
      <Line
        yAxisId="left"
        type="monotone"
        dataKey="income"
        stroke={incomeStroke}
        strokeWidth={1}
        dot={false}
        activeDot={false}
        name="总收入"
        hide={hiddenSeries.has('income')}
        isAnimationActive={false}
      />
      {!searchActive && (
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="balance"
          stroke={BALANCE_CHART_STROKE}
          strokeWidth={1.5}
          fill={`url(#${balanceGradientId})`}
          dot={false}
          activeDot={false}
          name="余额"
          connectNulls={false}
          hide={hiddenSeries.has('balance')}
          isAnimationActive={false}
        />
      )}
    </ComposedChart>
  );
}

export function statsChartWidth(rowCount: number, pointWidth: number) {
  return Math.max(rowCount * pointWidth, 320);
}
