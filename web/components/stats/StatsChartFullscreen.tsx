'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { StatsChartLegend } from '@/components/stats/StatsChartLegend';
import { StatsScrollChart } from '@/lib/dynamicStatsChart';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import {
  exitChartFullscreen,
  isCoarseMobile,
  isFullscreenCssRotated,
  shouldUsePortraitFallback,
} from '@/lib/statsChartFullscreen';
import {
  computeFullscreenSlotWidth,
  mapScrollFromAnchor,
  type ScrollAnchor,
} from '@/lib/statsChartScrollSync';
import type { StatsChartRow } from '@/lib/statsChartData';
import type { MonthSeriesPoint, YearSeriesPoint } from '@/lib/api';

function scrollUsesVerticalAxis(scrollEl: HTMLElement): boolean {
  return isFullscreenCssRotated(scrollEl);
}

type StatsChartFullscreenProps = {
  open: boolean;
  onClose: () => void;
  scrollAnchor: ScrollAnchor;
  defaultLimit: number;
  onSlotWidthChange: (slotWidth: number) => void;
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
};

export function StatsChartFullscreen({
  open,
  onClose,
  scrollAnchor,
  defaultLimit,
  onSlotWidthChange,
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
}: StatsChartFullscreenProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [chartHeight, setChartHeight] = useState(252);
  const [portraitFallback, setPortraitFallback] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const trackedScrollLeftRef = useRef(0);

  const syncTrackedScrollLeft = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isCoarseMobile()) return;
    trackedScrollLeftRef.current = el.scrollLeft;
  }, [scrollRef]);

  const handleScroll = useCallback(() => {
    syncTrackedScrollLeft();
    onScroll();
  }, [onScroll, syncTrackedScrollLeft]);

  const {
    onMouseDown: onChartMouseDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useHorizontalDragScroll(scrollRef, {
    enabled: open && !isCoarseMobile(),
    scrollAxis: portraitFallback ? 'y' : 'x',
    captureTouch: portraitFallback,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    syncTrackedScrollLeft();
    void exitChartFullscreen();
    onClose();
  }, [onClose, syncTrackedScrollLeft]);

  useEffect(() => {
    if (!open) {
      setPortraitFallback(false);
      return;
    }

    const syncFallback = () => {
      if (!isCoarseMobile()) {
        setPortraitFallback(false);
        return;
      }
      setPortraitFallback(shouldUsePortraitFallback());
    };

    syncFallback();
    const raf = requestAnimationFrame(syncFallback);
    const delayed = window.setTimeout(syncFallback, 100);

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
      cancelAnimationFrame(raf);
      window.clearTimeout(delayed);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      portraitMq.removeEventListener('change', syncFallback);
      landscapeMq.removeEventListener('change', syncFallback);
      screen.orientation?.removeEventListener('change', syncFallback);
      void exitChartFullscreen();
    };
  }, [open, handleClose]);

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
    if (!open) return;

    let el: HTMLDivElement | null = null;
    let raf = 0;
    let observer: ResizeObserver | null = null;

    const measure = () => {
      const target = scrollRef.current;
      if (!target) return;
      onSlotWidthChange(computeFullscreenSlotWidth(target.clientWidth, defaultLimit));
    };

    const bind = () => {
      el = scrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      observer?.disconnect();
      observer = new ResizeObserver(() => measure());
      observer.observe(el);
      measure();
    };

    bind();

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [open, defaultLimit, onSlotWidthChange, scrollRef, portraitFallback]);

  useEffect(() => {
    if (!open || rows.length === 0 || pointWidth <= 0 || scrollWidth <= 0) return;

    let raf = 0;
    const apply = () => {
      const el = scrollRef.current;
      if (!el) return;
      const nextScroll = mapScrollFromAnchor(
        scrollAnchor,
        el.clientWidth,
        pointWidth,
        rows.length,
        scrollWidth
      );
      el.scrollLeft = nextScroll;
      trackedScrollLeftRef.current = nextScroll;
    };

    raf = requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });

    return () => cancelAnimationFrame(raf);
  }, [open, scrollAnchor, pointWidth, scrollWidth, rows.length, scrollRef, portraitFallback]);

  useEffect(() => {
    if (!open || !isCoarseMobile()) return;

    let el: HTMLDivElement | null = null;
    let raf = 0;
    let bound = false;
    const TOUCH_SCROLL_THRESHOLD = 4;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let scrolling = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !el) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startScrollLeft = trackedScrollLeftRef.current;
      scrolling = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !el) return;
      const verticalAxis = scrollUsesVerticalAxis(el);
      const delta = verticalAxis ? touch.clientY - startY : touch.clientX - startX;
      if (!scrolling && Math.abs(delta) < TOUCH_SCROLL_THRESHOLD) return;
      scrolling = true;
      e.preventDefault();
      const nextScrollLeft = startScrollLeft - delta;
      el.scrollLeft = nextScrollLeft;
      trackedScrollLeftRef.current = nextScrollLeft;
    };

    const bind = () => {
      el = scrollRef.current;
      if (!el) {
        raf = requestAnimationFrame(bind);
        return;
      }
      if (bound) return;
      bound = true;
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
    };

    bind();

    return () => {
      cancelAnimationFrame(raf);
      if (el) {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
      }
    };
  }, [open, portraitFallback, scrollRef]);

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
        <button type="button" className="btn-ghost px-2 text-sm shrink-0" onClick={handleClose}>
          ← {t('common.back')}
        </button>
      </header>

      <div ref={scrollAreaRef} className="flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <div
          ref={scrollRef as React.RefObject<HTMLDivElement>}
          onScroll={handleScroll}
          onMouseDown={onChartMouseDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`stats-chart-scroll stats-chart-scroll-fullscreen stats-chart-scroll-tap-inspect h-full w-full min-w-0 overflow-x-auto overflow-y-hidden${portraitFallback ? ' stats-chart-scroll-rotated' : ''}`}
        >
          <div style={{ minWidth: scrollWidth }} className="stats-chart-scroll-inner stats-chart-scroll-inner-fullscreen px-4 pt-2 pb-3">
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
              tapToInspect
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
