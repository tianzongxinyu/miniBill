'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { StatsChartFullscreen } from '@/components/stats/StatsChartFullscreen';
import { StatsChartLegend } from '@/components/stats/StatsChartLegend';
import { StatsScrollChart, statsChartWidth } from '@/lib/dynamicStatsChart';
import { StatsSeriesTable } from '@/components/stats/StatsSeriesTable';
import { StatsToolbar } from '@/components/stats/StatsToolbar';
import { useStatsPage, STATS_SERIES_CONFIG } from '@/hooks/useStatsPage';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { buildStatsChartRows } from '@/lib/statsChartData';
import { useSettings } from '@/components/SettingsProvider';
import {
  enterChartFullscreen,
  exitChartFullscreen,
  isCoarseMobile,
} from '@/lib/statsChartFullscreen';
import {
  captureScrollAnchor,
  mapScrollFromAnchor,
  type ScrollAnchor,
} from '@/lib/statsChartScrollSync';

const DEFAULT_SCROLL_ANCHOR: ScrollAnchor = { centerIndex: 0, atEnd: true };

function StatsContent() {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const inlineScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenSlotWidth, setFullscreenSlotWidth] = useState<number>(
    STATS_SERIES_CONFIG.month.pointWidth
  );
  const fullscreenSlotWidthRef = useRef(fullscreenSlotWidth);
  const [scrollAnchor, setScrollAnchor] = useState<ScrollAnchor>(DEFAULT_SCROLL_ANCHOR);
  const pendingScrollLeftRef = useRef(0);
  const restoreInlineScrollRef = useRef(false);

  fullscreenSlotWidthRef.current = fullscreenSlotWidth;

  const scrollRef = fullscreenOpen ? fullscreenScrollRef : inlineScrollRef;
  const modeRef = useRef<'month' | 'year'>('month');

  const getPointWidth = useCallback(() => {
    if (fullscreenOpen) return fullscreenSlotWidthRef.current;
    return STATS_SERIES_CONFIG[modeRef.current].pointWidth;
  }, [fullscreenOpen]);

  const {
    onMouseDown: onChartMouseDown,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useHorizontalDragScroll(inlineScrollRef, {
    enabled: !fullscreenOpen,
  });

  const {
    mode,
    setMode,
    noteQuery,
    setNoteQuery,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    clearSearch,
    searchActive,
    monthSeries,
    yearSeries,
    active,
  } = useStatsPage(scrollRef, {
    autoFillViewport: !fullscreenOpen,
    getPointWidth,
  });

  modeRef.current = mode;

  const chartRows = useMemo(
    () => buildStatsChartRows(mode, monthSeries.items, yearSeries.items, searchActive, locale),
    [mode, monthSeries.items, yearSeries.items, searchActive, locale]
  );

  const seriesConfig = STATS_SERIES_CONFIG[mode];
  const inlinePointWidth = seriesConfig.pointWidth;
  const inlineScrollWidth = statsChartWidth(chartRows.length, inlinePointWidth);
  const fullscreenScrollWidth = statsChartWidth(chartRows.length, fullscreenSlotWidth);

  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenSeries(new Set());
  }, [searchActive, mode]);

  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);

  const handleSlotWidthChange = useCallback((slotWidth: number) => {
    setFullscreenSlotWidth(slotWidth);
  }, []);

  const openFullscreen = useCallback(async () => {
    const inlineEl = inlineScrollRef.current;
    const itemCount = chartRows.length;
    if (inlineEl && itemCount > 0) {
      setScrollAnchor(
        captureScrollAnchor(
          inlineEl.scrollLeft,
          inlineEl.clientWidth,
          inlinePointWidth,
          itemCount,
          inlineScrollWidth
        )
      );
    } else {
      setScrollAnchor(DEFAULT_SCROLL_ANCHOR);
    }
    if (isCoarseMobile()) {
      await enterChartFullscreen();
    }
    setFullscreenOpen(true);
  }, [chartRows.length, inlinePointWidth, inlineScrollWidth]);

  const closeFullscreen = useCallback(() => {
    const fsEl = fullscreenScrollRef.current;
    const itemCount = chartRows.length;
    const inlineEl = inlineScrollRef.current;

    if (fsEl && itemCount > 0) {
      const fsPointWidth = fullscreenSlotWidthRef.current;
      const fsScrollWidth = statsChartWidth(itemCount, fsPointWidth);
      const anchor = captureScrollAnchor(
        fsEl.scrollLeft,
        fsEl.clientWidth,
        fsPointWidth,
        itemCount,
        fsScrollWidth
      );
      pendingScrollLeftRef.current = mapScrollFromAnchor(
        anchor,
        inlineEl?.clientWidth ?? fsEl.clientWidth,
        inlinePointWidth,
        itemCount,
        inlineScrollWidth
      );
    }

    restoreInlineScrollRef.current = true;
    setFullscreenOpen(false);
    void exitChartFullscreen();
  }, [chartRows.length, inlinePointWidth, inlineScrollWidth]);

  useEffect(() => {
    if (fullscreenOpen || !restoreInlineScrollRef.current) return;
    restoreInlineScrollRef.current = false;
    const el = inlineScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollLeft = pendingScrollLeftRef.current;
    });
  }, [fullscreenOpen]);

  return (
    <div>
      <StatsToolbar
        note={noteQuery}
        onNoteChange={setNoteQuery}
        selectedTagIds={selectedTagIds}
        onTagIdsChange={setSelectedTagIds}
        contactId={contactId}
        onContactIdChange={setContactId}
        onClear={clearSearch}
        mode={mode}
        onModeChange={setMode}
      />

      <div className="notebook mb-3 overflow-hidden relative">
        <button
          type="button"
          onClick={openFullscreen}
          className="absolute top-2 right-2 z-10 btn-ghost p-1.5 rounded-lg text-muted hover:text-ink"
          aria-label={t('stats.fullscreen')}
          title={t('stats.fullscreen')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
            />
          </svg>
        </button>
        <div
          ref={inlineScrollRef}
          onScroll={fullscreenOpen ? undefined : active.onScroll}
          onMouseDown={fullscreenOpen ? undefined : onChartMouseDown}
          onPointerDown={fullscreenOpen ? undefined : onPointerDown}
          onPointerMove={fullscreenOpen ? undefined : onPointerMove}
          onPointerUp={fullscreenOpen ? undefined : onPointerUp}
          onPointerCancel={fullscreenOpen ? undefined : onPointerCancel}
          className="stats-chart-scroll overflow-x-auto min-h-[252px]"
        >
          <div style={{ minWidth: inlineScrollWidth }} className="stats-chart-scroll-inner px-4 pt-4">
            <StatsScrollChart
              mode={mode}
              monthItems={monthSeries.items}
              yearItems={yearSeries.items}
              searchActive={searchActive}
              loading={active.loading}
              pointWidth={inlinePointWidth}
              rows={chartRows}
              hiddenSeries={hiddenSeries}
            />
          </div>
        </div>
        <StatsChartLegend
          searchActive={searchActive}
          hiddenSeries={hiddenSeries}
          onToggleSeries={toggleSeries}
        />
      </div>

      <StatsChartFullscreen
        open={fullscreenOpen}
        onClose={closeFullscreen}
        scrollAnchor={scrollAnchor}
        defaultLimit={seriesConfig.limit}
        onSlotWidthChange={handleSlotWidthChange}
        scrollRef={fullscreenScrollRef}
        onScroll={active.onScroll}
        mode={mode}
        monthItems={monthSeries.items}
        yearItems={yearSeries.items}
        searchActive={searchActive}
        loading={active.loading}
        pointWidth={fullscreenSlotWidth}
        rows={chartRows}
        hiddenSeries={hiddenSeries}
        onToggleSeries={toggleSeries}
        scrollWidth={fullscreenScrollWidth}
      />

      <StatsSeriesTable
        mode={mode}
        rows={chartRows}
        searchActive={searchActive}
        hiddenSeries={hiddenSeries}
      />

      {(active.loadingOlder || active.loadingNewer) && (
        <p className="text-xs text-muted mb-2">{t('stats.loadMore')}</p>
      )}

      <p className="text-xs text-muted">{t('stats.scrollHint')}</p>
    </div>
  );
}

export default function StatsPage() {
  return (
    <RequireAuth>
      <StatsContent />
    </RequireAuth>
  );
}
