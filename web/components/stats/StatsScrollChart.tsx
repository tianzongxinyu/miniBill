'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
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
import { isFullscreenCssRotated } from '@/lib/statsChartFullscreen';

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

const SERIES_LABEL_KEYS: Record<string, string> = {
  expense: 'stats.totalExpense',
  income: 'stats.totalIncome',
  net: 'stats.netIncome',
  balance: 'stats.balance',
};

function formatTooltipValue(
  dataKey: string,
  yuan: number,
  scheme: AmountColorScheme,
  locale: string
) {
  const cents = Math.round(yuan * 100);
  switch (dataKey) {
    case 'income':
      return { text: formatTypedMoney(cents, 'income', locale), className: amountClassForType('income', scheme) };
    case 'expense':
      return { text: formatTypedMoney(cents, 'expense', locale), className: amountClassForType('expense', scheme) };
    case 'net':
      return { text: formatSignedMoney(cents, locale), className: amountClassForSign(cents, scheme) };
    case 'balance':
      return { text: formatBalanceMoney(cents, locale), className: 'text-ink font-medium' };
    default:
      return { text: formatSignedMoney(cents, locale), className: 'text-ink' };
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
  locale,
  seriesLabels,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string | number;
  scheme: AmountColorScheme;
  locale: string;
  seriesLabels: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-line/80 bg-surface px-3 py-2 text-xs shadow-panel">
      <p className="text-muted mb-1.5">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? '');
          const yuan = Number(entry.value ?? 0);
          const { text, className } = formatTooltipValue(key, yuan, scheme, locale);
          return (
            <li key={key} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="text-muted">{seriesLabels[key] ?? key}</span>
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
      data-category-name={label}
      data-category-x={x}
      style={{ cursor: tapToInspect ? 'pointer' : undefined, pointerEvents: tapToInspect ? 'none' : undefined }}
    >
      {label}
    </text>
  );
}

const CHART_MARGIN = { top: 8, right: 8, left: 16, bottom: 16 };
const CHART_MARGIN_FULLSCREEN = { top: 8, right: 8, left: 16, bottom: 28 };
const Y_AXIS_WIDTH = 8;
const SCROLL_CLEAR_THRESHOLD = 12;
const PICK_DEBOUNCE_MS = 450;
/** Chart-space gap so tap tooltip sits beside the reference line, not on it. */
const TOOLTIP_LINE_GAP = 14;
const TOOLTIP_EDGE_PAD = 8;

function computeTapInspectTooltipStyle(
  tooltipLeft: number,
  tooltipWidth: number,
  chartWidth: number
): { left: number; top: number; transform: string } {
  const gap = TOOLTIP_LINE_GAP;
  const fitsRight = tooltipLeft + gap + tooltipWidth <= chartWidth - TOOLTIP_EDGE_PAD;
  const fitsLeft = tooltipLeft - gap - tooltipWidth >= TOOLTIP_EDGE_PAD;

  if (fitsRight || !fitsLeft) {
    return { left: tooltipLeft + gap, top: 8, transform: 'none' };
  }
  return { left: tooltipLeft - gap, top: 8, transform: 'translateX(-100%)' };
}

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function tapDisplacementThreshold(): number {
  if (typeof window === 'undefined') return 8;
  return isCoarsePointer() ? 32 : 8;
}

type ChartPointerState = {
  activeTooltipIndex?: number | string;
  activeLabel?: string | number;
  activeCoordinate?: { x?: number; y?: number };
};

type CategoryPick = {
  index: number;
  tooltipLeft: number;
};

function categoryCenterX(
  index: number,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean,
  tapToInspect: boolean
): number {
  const margin = tapToInspect ? CHART_MARGIN_FULLSCREEN : CHART_MARGIN;
  const yAxisRight = searchActive ? 0 : Y_AXIS_WIDTH;
  const innerW = chartWidth - margin.left - margin.right - Y_AXIS_WIDTH - yAxisRight;
  const halfPoint = pointWidth / 2;
  const plotStart = margin.left + Y_AXIS_WIDTH + halfPoint;
  if (dataLength <= 1) return plotStart;
  const step = (innerW - 2 * halfPoint) / (dataLength - 1);
  return plotStart + index * step;
}

function queryCategoryTickNodes(shellEl: HTMLElement): Element[] {
  const byAttr = shellEl.querySelectorAll('[data-category-name]');
  if (byAttr.length > 0) return Array.from(byAttr);

  return Array.from(
    shellEl.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick text, .recharts-xAxis text')
  );
}

function readTickName(node: Element): string | null {
  const fromAttr = node.getAttribute('data-category-name');
  if (fromAttr) return fromAttr;
  const text = node.textContent?.trim();
  return text || null;
}

function readTickSvgX(node: Element): number | null {
  const fromAttr = node.getAttribute('data-category-x') ?? node.getAttribute('x');
  if (fromAttr == null) return null;
  const tickX = Number(fromAttr);
  return Number.isFinite(tickX) ? tickX : null;
}

function localXFromSvgCtm(clientX: number, clientY: number, shellEl: HTMLElement): number | null {
  const svg = shellEl.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm.inverse()).x;
}

function chartXToScreenY(chartX: number, shellEl: HTMLElement): number | null {
  const svg = shellEl.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) return null;
  const pt = svg.createSVGPoint();
  pt.x = chartX;
  pt.y = 0;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  return pt.matrixTransform(ctm).y;
}

function pickIndexFromPlotFormula(
  localX: number,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number {
  const margin = CHART_MARGIN_FULLSCREEN;
  const yAxisRight = searchActive ? 0 : Y_AXIS_WIDTH;
  const innerW = chartWidth - margin.left - margin.right - Y_AXIS_WIDTH - yAxisRight;
  const halfPoint = pointWidth / 2;
  const plotStart = margin.left + Y_AXIS_WIDTH + halfPoint;

  if (dataLength <= 1) return 0;
  const step = (innerW - 2 * halfPoint) / (dataLength - 1);
  const idx = Math.round((localX - plotStart) / step);
  return Math.max(0, Math.min(dataLength - 1, idx));
}

type SlotPickAxis = 'x' | 'y';

function pickNearestSlot(
  clientX: number,
  clientY: number,
  shellEl: HTMLElement,
  axis: SlotPickAxis,
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number {
  const shellRect = shellEl.getBoundingClientRect();
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < dataLength; i++) {
    const slotX = categoryCenterX(i, chartWidth, dataLength, pointWidth, searchActive, true);
    let dist: number;
    if (axis === 'x') {
      dist = Math.abs(clientX - (shellRect.left + slotX));
    } else {
      const screenY = chartXToScreenY(slotX, shellEl);
      if (screenY == null) continue;
      dist = Math.abs(clientY - screenY);
    }
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  if (bestDist === Infinity && axis === 'y') {
    const localX = localXFromSvgCtm(clientX, clientY, shellEl);
    if (localX != null) {
      return pickIndexFromPlotFormula(localX, chartWidth, dataLength, pointWidth, searchActive);
    }
  }

  return bestIndex;
}

function pickRotatedCategoryFromTicks(
  clientY: number,
  shellEl: HTMLElement,
  categoryNames: readonly string[]
): number | null {
  const ticks = queryCategoryTickNodes(shellEl);
  if (ticks.length === 0) return null;

  let bestName: string | null = null;
  let bestDist = Infinity;

  for (const node of ticks) {
    const name = readTickName(node);
    if (!name || categoryNames.indexOf(name) < 0) continue;
    const rect = node.getBoundingClientRect();
    const dist = Math.abs(clientY - (rect.top + rect.height / 2));
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }

  if (bestName == null) return null;
  const index = categoryNames.indexOf(bestName);
  return index >= 0 ? index : null;
}

function tooltipAnchorX(
  index: number,
  shellEl: HTMLElement,
  categoryNames: readonly string[],
  chartWidth: number,
  dataLength: number,
  pointWidth: number,
  searchActive: boolean
): number {
  const name = categoryNames[index];

  if (isFullscreenCssRotated(shellEl)) {
    const tickNode = queryCategoryTickNodes(shellEl).find((node) => readTickName(node) === name);
    return (
      (tickNode ? readTickSvgX(tickNode) : null) ??
      categoryCenterX(index, chartWidth, dataLength, pointWidth, searchActive, true)
    );
  }

  const shellRect = shellEl.getBoundingClientRect();
  for (const node of queryCategoryTickNodes(shellEl)) {
    if (readTickName(node) !== name) continue;
    const rect = node.getBoundingClientRect();
    return rect.left + rect.width / 2 - shellRect.left;
  }

  return categoryCenterX(index, chartWidth, dataLength, pointWidth, searchActive, true);
}

function pickCategoryAtPointer(
  clientX: number,
  clientY: number,
  shellEl: HTMLElement,
  chartWidth: number,
  categoryNames: readonly string[],
  pointWidth: number,
  searchActive: boolean,
  tapToInspect: boolean
): CategoryPick | null {
  const dataLength = categoryNames.length;
  if (!tapToInspect || dataLength === 0) return null;

  const index = isFullscreenCssRotated(shellEl)
    ? (pickRotatedCategoryFromTicks(clientY, shellEl, categoryNames) ??
      pickNearestSlot(
        clientX,
        clientY,
        shellEl,
        'y',
        chartWidth,
        dataLength,
        pointWidth,
        searchActive
      ))
    : pickNearestSlot(
        clientX,
        clientY,
        shellEl,
        'x',
        chartWidth,
        dataLength,
        pointWidth,
        searchActive
      );

  return {
    index,
    tooltipLeft: tooltipAnchorX(
      index,
      shellEl,
      categoryNames,
      chartWidth,
      dataLength,
      pointWidth,
      searchActive
    ),
  };
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
  const { t } = useTranslation();
  const { scheme, locale } = useSettings();
  const seriesLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(SERIES_LABEL_KEYS).map(([key, labelKey]) => [key, t(labelKey)])
      ),
    [t]
  );
  const [pinned, setPinned] = useState<CategoryPick | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>;
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPickAtRef = useRef(0);
  const tapInspectCleanupRef = useRef<(() => void) | null>(null);
  const balanceGradientId = useId().replace(/:/g, '');
  const netGradientId = useId().replace(/:/g, '');
  const incomeStroke = chartStrokeForType('income', scheme);
  const expenseStroke = chartStrokeForType('expense', scheme);

  const rows = useMemo(
    () =>
      rowsProp.length > 0
        ? rowsProp
        : buildStatsChartRows(mode, monthItems, yearItems, searchActive, locale),
    [rowsProp, mode, monthItems, yearItems, searchActive, locale]
  );

  const chartData = useMemo(() => rows.map(chartRowToSeries), [rows]);
  const categoryNames = useMemo(() => chartData.map((row) => String(row.name)), [chartData]);

  useEffect(() => {
    setPinned(null);
  }, [tapToInspect, mode, searchActive, chartData.length]);

  useEffect(() => {
    if (!tapToInspect) return;
    const el = shellRef.current?.closest('.stats-chart-scroll');
    if (!el) return;
    let prevScrollLeft = el.scrollLeft;
    const onScroll = () => {
      if (Math.abs(el.scrollLeft - prevScrollLeft) > SCROLL_CLEAR_THRESHOLD) {
        setPinned(null);
      }
      prevScrollLeft = el.scrollLeft;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [tapToInspect]);

  const chartWidth = Math.max(chartData.length * pointWidth, 320);
  const halfPoint = pointWidth / 2;
  const { left: yDomain, right: rightDomain } = useMemo(
    () => chartAxisDomains(rows, hiddenSeries, searchActive),
    [rows, hiddenSeries, searchActive]
  );
  const yTicks = useMemo(() => axisTickValues(yDomain, 4), [yDomain]);
  const rightTicks = useMemo(() => axisTickValues(rightDomain, 4), [rightDomain]);

  const renderTooltip = useCallback(
    (props: { active?: boolean; payload?: TooltipPayload; label?: string | number }) => (
      <StatsChartTooltip
        active={props.active}
        payload={props.payload}
        label={props.label}
        scheme={scheme}
        locale={locale}
        seriesLabels={seriesLabels}
      />
    ),
    [scheme, locale, seriesLabels]
  );

  const applyPickAt = useCallback((pick: CategoryPick) => {
    setPinned((prev) => (prev?.index === pick.index ? null : pick));
  }, []);

  const commitPick = useCallback(
    (pick: CategoryPick) => {
      const now = Date.now();
      if (now - lastPickAtRef.current < PICK_DEBOUNCE_MS) return;
      lastPickAtRef.current = now;
      applyPickAt(pick);
    },
    [applyPickAt]
  );

  const tryPickAt = useCallback(
    (clientX: number, clientY: number) => {
      const shell = shellRef.current;
      if (!shell) return;
      const pick = pickCategoryAtPointer(
        clientX,
        clientY,
        shell,
        chartWidth,
        categoryNames,
        pointWidth,
        searchActive,
        tapToInspect
      );
      if (pick == null) return;
      commitPick(pick);
    },
    [commitPick, categoryNames, chartWidth, pointWidth, searchActive, tapToInspect]
  );

  const handleChartPointer = useCallback(
    (state: ChartPointerState, event: React.SyntheticEvent) => {
      if (!tapToInspect) return;

      const label = state.activeLabel;
      if (!isCoarsePointer() && label != null) {
        const index = categoryNames.indexOf(String(label));
        const shell = shellRef.current;
        if (index >= 0 && shell) {
          commitPick({
            index,
            tooltipLeft: tooltipAnchorX(
              index,
              shell,
              categoryNames,
              chartWidth,
              chartData.length,
              pointWidth,
              searchActive
            ),
          });
          return;
        }
      }

      const native = event.nativeEvent;
      let clientX: number | undefined;
      let clientY: number | undefined;
      if (native instanceof MouseEvent) {
        clientX = native.clientX;
        clientY = native.clientY;
      } else if (native instanceof TouchEvent) {
        const touch = native.changedTouches[0] ?? native.touches[0];
        if (touch) {
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
      }
      if (clientX == null || clientY == null) return;
      tryPickAt(clientX, clientY);
    },
    [
      tapToInspect,
      categoryNames,
      chartData.length,
      chartWidth,
      commitPick,
      pointWidth,
      searchActive,
      tryPickAt,
    ]
  );

  const bindTapInspectListeners = useCallback(
    (shell: HTMLDivElement | null) => {
      tapInspectCleanupRef.current?.();
      tapInspectCleanupRef.current = null;
      if (!tapToInspect || !shell) return;

      const scrollEl = shell.closest('.stats-chart-scroll') as HTMLElement | null;
      const target = scrollEl ?? shell;

      const onTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        tapStartRef.current = { x: touch.clientX, y: touch.clientY };
      };

      const onTouchMove = (e: TouchEvent) => {
        void e;
      };

      const onTouchEnd = (e: TouchEvent) => {
        const touch = e.changedTouches[0];
        if (!touch || !tapStartRef.current) return;
        const start = tapStartRef.current;
        tapStartRef.current = null;

        const threshold = tapDisplacementThreshold();
        if (
          Math.abs(touch.clientX - start.x) > threshold ||
          Math.abs(touch.clientY - start.y) > threshold
        ) {
          return;
        }
        tryPickAt(touch.clientX, touch.clientY);
      };

      const capture = { passive: true, capture: true as const };
      target.addEventListener('touchstart', onTouchStart, capture);
      target.addEventListener('touchmove', onTouchMove, capture);
      target.addEventListener('touchend', onTouchEnd, capture);
      tapInspectCleanupRef.current = () => {
        target.removeEventListener('touchstart', onTouchStart, capture);
        target.removeEventListener('touchmove', onTouchMove, capture);
        target.removeEventListener('touchend', onTouchEnd, capture);
      };
    },
    [tapToInspect, tryPickAt]
  );

  const setShellRef = useCallback(
    (node: HTMLDivElement | null) => {
      shellRef.current = node;
      bindTapInspectListeners(node);
    },
    [bindTapInspectListeners]
  );

  useEffect(() => {
    if (tapToInspect && shellRef.current) {
      bindTapInspectListeners(shellRef.current);
    }
    if (!tapToInspect) {
      bindTapInspectListeners(null);
    }
  }, [tapToInspect, bindTapInspectListeners]);

  useEffect(() => {
    return () => {
      tapInspectCleanupRef.current?.();
      tapInspectCleanupRef.current = null;
    };
  }, []);

  const pinnedRow = pinned != null ? chartData[pinned.index] : null;
  const tapTooltipRef = useRef<HTMLDivElement | null>(null);
  const [tapTooltipStyle, setTapTooltipStyle] = useState(() => ({
    left: 0,
    top: 8,
    transform: 'none',
  }));

  useLayoutEffect(() => {
    if (!tapToInspect || pinned == null) return;
    const measured = tapTooltipRef.current?.offsetWidth ?? 0;
    const width = measured > 0 ? measured : 280;
    setTapTooltipStyle(
      computeTapInspectTooltipStyle(pinned.tooltipLeft, width, chartWidth)
    );
  }, [
    tapToInspect,
    pinned,
    chartWidth,
    pinnedRow,
    searchActive,
    hiddenSeries,
    scheme,
    locale,
    seriesLabels,
  ]);

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
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div
      ref={setShellRef}
      style={{ width: chartWidth, height }}
      className={tapToInspect ? 'relative cursor-pointer select-none stats-chart-tap-inspect' : undefined}
    >
      {tapToInspect && pinned && pinnedRow && (
        <div
          ref={tapTooltipRef}
          className="absolute z-30 pointer-events-none w-max max-w-[min(20rem,calc(100%-1rem))]"
          style={tapTooltipStyle}
        >
          <StatsChartTooltip
            active
            payload={buildTooltipPayload(pinnedRow, searchActive, hiddenSeries)}
            label={pinnedRow.name}
            scheme={scheme}
            locale={locale}
            seriesLabels={seriesLabels}
          />
        </div>
      )}
      <ComposedChart
        width={chartWidth}
        height={height}
        data={chartData}
        margin={{ top: chartMargin.top, right: chartMargin.right, left: chartMargin.left, bottom: chartMargin.bottom }}
        onClick={tapToInspect && !isCoarsePointer() ? handleChartPointer : undefined}
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
        interval={tapToInspect ? 0 : 'preserveStartEnd'}
        minTickGap={tapToInspect ? 12 : 16}
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
      {tapToInspect && pinnedRow && (
        <ReferenceLine
          x={pinnedRow.name}
          yAxisId="left"
          stroke="#8a9390"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
      {!tapToInspect && (
        <Tooltip
          content={renderTooltip}
          trigger="hover"
          cursor={{ stroke: '#8a9390', strokeWidth: 1, strokeDasharray: '4 4' }}
          wrapperStyle={{ pointerEvents: 'none', zIndex: 20 }}
        />
      )}
      {!searchActive && (
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="net"
          stroke={NET_INCOME_CHART_STROKE}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill={`url(#${netGradientId})`}
          dot={false}
          activeDot={false}
          name={seriesLabels.net}
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
        name={seriesLabels.expense}
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
        name={seriesLabels.income}
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
          strokeDasharray="4 4"
          fill={`url(#${balanceGradientId})`}
          dot={false}
          activeDot={false}
          name={seriesLabels.balance}
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
