'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  chartAxisDomains,
  chartRowToSeries,
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
  /** 全屏模式：点击时间轴或图表区域固定显示数据 */
  tapToInspect?: boolean;
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

type SeriesRow = ReturnType<typeof chartRowToSeries>;

function buildTooltipPayload(
  row: SeriesRow,
  searchActive: boolean,
  hiddenSeries: Set<string>
): TooltipPayload {
  const keys = searchActive
    ? (['expense', 'income'] as const)
    : (['expense', 'income', 'net', 'balance'] as const);
  return keys
    .filter((key) => !hiddenSeries.has(key))
    .filter((key) => row[key] != null)
    .map((key) => ({ dataKey: key, value: row[key] as number }));
}

function XAxisTick({
  x,
  y,
  payload,
  tapToInspect,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  tapToInspect?: boolean;
}) {
  const label = payload?.value;
  if (label == null || x == null || y == null) return null;

  return (
    <text
      x={x}
      y={y}
      dy={16}
      textAnchor="middle"
      fill="#8a9390"
      fontSize={12}
      style={{ cursor: tapToInspect ? 'pointer' : undefined, pointerEvents: tapToInspect ? 'none' : undefined }}
    >
      {label}
    </text>
  );
}

const CHART_MARGIN = { top: 8, right: 8, left: 16, bottom: 16 };
const CHART_MARGIN_FULLSCREEN = { top: 8, right: 8, left: 16, bottom: 28 };
const Y_AXIS_WIDTH = 8;

/** Map screen pointer to nearest category index (matches Recharts scale="point" layout). */
function pickIndexFromChartPointer(
  clientX: number,
  clientY: number,
  shellEl: HTMLElement,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number | null {
  if (dataLength === 0) return null;
  const surface = shellEl.querySelector('.recharts-surface') as SVGSVGElement | null;
  if (!surface) return null;

  const pt = surface.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const inv = surface.getScreenCTM()?.inverse();
  if (!inv) return null;
  const { x: svgX } = pt.matrixTransform(inv);

  const yAxisRight = searchActive ? 0 : Y_AXIS_WIDTH;
  const innerW =
    chartWidth - CHART_MARGIN.left - CHART_MARGIN.right - Y_AXIS_WIDTH - yAxisRight;
  const halfPoint = pointWidth / 2;
  const plotStart = CHART_MARGIN.left + Y_AXIS_WIDTH + halfPoint;

  let idx: number;
  if (dataLength <= 1) {
    idx = 0;
  } else {
    const step = (innerW - 2 * halfPoint) / (dataLength - 1);
    idx = Math.round((svgX - plotStart) / step);
  }
  if (idx < 0 || idx >= dataLength) return null;
  return idx;
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
  tapToInspect = false,
}: StatsScrollChartProps) {
  const { scheme } = useSettings();
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    setPinnedIndex(null);
  }, [tapToInspect, mode, searchActive, chartData.length]);

  const chartWidth = Math.max(chartData.length * pointWidth, 320);
  const halfPoint = pointWidth / 2;
  const { left: yDomain, right: rightDomain } = useMemo(
    () => chartAxisDomains(rows, hiddenSeries, searchActive),
    [rows, hiddenSeries, searchActive]
  );
  const yTicks = useMemo(() => axisTickValues(yDomain, 4), [yDomain]);
  const rightTicks = useMemo(() => axisTickValues(rightDomain, 4), [rightDomain]);

  const renderTooltip = useCallback(
    (props: { active?: boolean; payload?: TooltipPayload; label?: string | number }) => {
      if (tapToInspect && pinnedIndex != null) {
        const row = chartData[pinnedIndex];
        if (!row) return null;
        return (
          <StatsChartTooltip
            active
            payload={buildTooltipPayload(row, searchActive, hiddenSeries)}
            label={row.name}
            scheme={scheme}
          />
        );
      }
      return (
        <StatsChartTooltip
          active={props.active}
          payload={props.payload}
          label={props.label}
          scheme={scheme}
        />
      );
    },
    [scheme, tapToInspect, pinnedIndex, chartData, searchActive, hiddenSeries]
  );

  const pickAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      const shell = shellRef.current;
      if (!shell) return;
      const idx = pickIndexFromChartPointer(
        clientX,
        clientY,
        shell,
        chartWidth,
        chartData.length,
        pointWidth,
        searchActive
      );
      if (idx == null) return;
      setPinnedIndex((prev) => (prev === idx ? null : idx));
    },
    [chartData.length, chartWidth, pointWidth, searchActive]
  );

  const handleShellPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!tapToInspect || e.button !== 0) return;
      tapStartRef.current = { x: e.clientX, y: e.clientY };
    },
    [tapToInspect]
  );

  const handleShellPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!tapToInspect || e.button !== 0 || !tapStartRef.current) return;
      const start = tapStartRef.current;
      tapStartRef.current = null;
      const scrollEl = shellRef.current?.closest('.stats-chart-scroll');
      if (scrollEl?.classList.contains('is-dragging')) return;
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx > 4 || dy > 4) return;
      pickAtPointer(e.clientX, e.clientY);
    },
    [tapToInspect, pickAtPointer]
  );

  const renderXAxisTick = useCallback(
    (props: { x?: number; y?: number; payload?: { value?: string } }) => (
      <XAxisTick {...props} tapToInspect={tapToInspect} />
    ),
    [tapToInspect]
  );

  const chartMargin = tapToInspect ? CHART_MARGIN_FULLSCREEN : CHART_MARGIN;
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
    <div
      ref={shellRef}
      style={{ width: chartWidth, height }}
      className={tapToInspect ? 'cursor-pointer select-none' : undefined}
      onPointerDown={tapToInspect ? handleShellPointerDown : undefined}
      onPointerUp={tapToInspect ? handleShellPointerUp : undefined}
    >
      <ComposedChart
        width={chartWidth}
        height={height}
        data={chartData}
        margin={{ top: chartMargin.top, right: chartMargin.right, left: chartMargin.left, bottom: chartMargin.bottom }}
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
        interval={tapToInspect ? 'equidistantPreserveStart' : 'preserveStartEnd'}
        minTickGap={tapToInspect ? 44 : 32}
        tick={tapToInspect ? renderXAxisTick : { fill: '#8a9390', fontSize: 12 }}
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
      <Tooltip
        content={renderTooltip}
        trigger={tapToInspect ? 'click' : 'hover'}
        active={tapToInspect && pinnedIndex != null ? true : undefined}
        defaultIndex={tapToInspect && pinnedIndex != null ? pinnedIndex : undefined}
        cursor={{ stroke: '#8a9390', strokeWidth: 1, strokeDasharray: '4 4' }}
        wrapperStyle={{ pointerEvents: 'none', zIndex: 20 }}
      />
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
    </div>
  );
}

export function statsChartWidth(rowCount: number, pointWidth: number) {
  return Math.max(rowCount * pointWidth, 320);
}
