'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/LoadingFallback';
import { StatsChartLegend } from '@/components/stats/StatsChartLegend';
import { statsChartWidth } from '@/components/stats/StatsScrollChart';
import {
  exitChartFullscreen,
  isCoarseMobile,
  shouldUsePortraitFallback,
} from '@/lib/statsChartFullscreen';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import type { StatsChartRow } from '@/lib/statsChartData';
import type { MonthSeriesPoint, YearSeriesPoint } from '@/lib/api';

const StatsScrollChart = dynamic(
  () => import('@/components/stats/StatsScrollChart').then((m) => m.StatsScrollChart),
  { ssr: false, loading: () => <ChartSkeleton height={252} /> }
);

type StatsChartFullscreenProps = {
  open: boolean;
  onClose: () => void;
  initialScrollLeft: number;
  onScrollLeftChange: (scrollLeft: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  mode: 'month' | 'year';
  monthItems: MonthSeriesPoint[];
  yearItems: YearSeriesPoint[];
  searchActive: boolean;
  loading: boolean;
  pointWidth: number;
  rows: StatsChartRow[];
  hiddenSeries: Set<string>;
  onToggleSeries: (dataKey: string) => void;
  scrollWidth: number;
  portraitFallback?: boolean;
};

export function StatsChartFullscreen({
  open,
  onClose,
  initialScrollLeft,
  onScrollLeftChange,
  scrollRef,
  onScroll,
  mode,
  monthItems,
  yearItems,
  searchActive,
  loading,
  pointWidth,
  rows,
  hiddenSeries,
  onToggleSeries,
  scrollWidth,
  portraitFallback: portraitFallbackProp = false,
}: StatsChartFullscreenProps) {
  const [mounted, setMounted] = useState(false);
  const [chartHeight, setChartHeight] = useState(252);
  const [portraitFallback, setPortraitFallback] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  const rotatedScroll = portraitFallbackProp || portraitFallback;

  const { onMouseDown: onChartMouseDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } =
    useHorizontalDragScroll(scrollRef, {
      enabled: open,
      scrollAxis: rotatedScroll ? 'y' : 'x',
      captureTouch: rotatedScroll,
    });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    onScrollLeftChange(scrollRef.current?.scrollLeft ?? initialScrollLeft);
    void exitChartFullscreen();
    onClose();
  }, [initialScrollLeft, onClose, onScrollLeftChange, scrollRef]);

  useEffect(() => {
    if (!open) {
      restoredScrollRef.current = false;
      setPortraitFallback(false);
      return;
    }

    const syncFallback = () => {
      if (!isCoarseMobile()) {
        setPortraitFallback(false);
        return;
      }
      setPortraitFallback(portraitFallbackProp || shouldUsePortraitFallback());
    };

    syncFallback();

    const portraitMq = window.matchMedia('(orientation: portrait)');
    const landscapeMq = window.matchMedia('(orientation: landscape)');
    portraitMq.addEventListener('change', syncFallback);
    landscapeMq.addEventListener('change', syncFallback);
    screen.orientation?.addEventListener('change', syncFallback);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      portraitMq.removeEventListener('change', syncFallback);
      landscapeMq.removeEventListener('change', syncFallback);
      screen.orientation?.removeEventListener('change', syncFallback);
      void exitChartFullscreen();
    };
  }, [open, portraitFallbackProp, handleClose]);

  useEffect(() => {
    if (!open) return;
    const el = scrollAreaRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.max(Math.floor(entry.contentRect.height), 160);
      setChartHeight(nextHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, portraitFallback]);

  useEffect(() => {
    if (!open || restoredScrollRef.current) return;
    const el = scrollRef.current;
    if (!el) return;

    restoredScrollRef.current = true;
    requestAnimationFrame(() => {
      el.scrollLeft = initialScrollLeft;
    });
  }, [open, initialScrollLeft, scrollRef]);

  if (!mounted || !open) return null;

  const panelClass = portraitFallback
    ? 'stats-chart-fullscreen-landscape flex flex-col bg-canvas'
    : 'fixed inset-0 z-50 flex flex-col bg-canvas';

  const shellClass = portraitFallback
    ? 'fixed inset-0 z-50 overflow-hidden bg-canvas'
    : undefined;

  const content = (
    <div className={panelClass}>
      <header className="shrink-0 flex items-center px-3 py-2 border-b border-line/60 bg-canvas/95 backdrop-blur-sm">
        <button type="button" className="btn-ghost px-2 text-sm" onClick={handleClose}>
          ← 返回
        </button>
      </header>

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef as React.RefObject<HTMLDivElement>}
          onScroll={onScroll}
          onMouseDown={onChartMouseDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`stats-chart-scroll stats-chart-scroll-fullscreen h-full overflow-x-auto overflow-y-hidden${rotatedScroll ? ' stats-chart-scroll-rotated' : ''}`}
        >
          <div style={{ minWidth: scrollWidth }} className="stats-chart-scroll-inner px-4 pt-2 h-full">
            <StatsScrollChart
              mode={mode}
              monthItems={monthItems}
              yearItems={yearItems}
              searchActive={searchActive}
              loading={loading}
              pointWidth={pointWidth}
              rows={rows}
              hiddenSeries={hiddenSeries}
              height={chartHeight}
            />
          </div>
        </div>
      </div>

      <StatsChartLegend
        searchActive={searchActive}
        hiddenSeries={hiddenSeries}
        onToggleSeries={onToggleSeries}
      />
    </div>
  );

  return createPortal(
    portraitFallback ? <div className={shellClass}>{content}</div> : content,
    document.body
  );
}

export { statsChartWidth };
