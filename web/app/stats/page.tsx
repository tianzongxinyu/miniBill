'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { StatsChartFullscreen } from '@/components/stats/StatsChartFullscreen';
import { StatsChartLegend } from '@/components/stats/StatsChartLegend';
import { StatsScrollChart, statsChartWidth } from '@/lib/dynamicStatsChart';
import { StatsSeriesTable } from '@/components/stats/StatsSeriesTable';
import { StatsToolbar } from '@/components/stats/StatsToolbar';
import { useStatsPage } from '@/hooks/useStatsPage';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { buildStatsChartRows } from '@/lib/statsChartData';
import {
  enterChartFullscreen,
  exitChartFullscreen,
  isCoarseMobile,
} from '@/lib/statsChartFullscreen';

function StatsContent() {
  const { t } = useTranslation();
  const inlineScrollRef = useRef<HTMLDivElement>(null);
  const fullscreenScrollRef = useRef<HTMLDivElement>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const pendingScrollLeftRef = useRef(0);

  const scrollRef = fullscreenOpen ? fullscreenScrollRef : inlineScrollRef;

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
  } = useStatsPage(scrollRef);

  const chartRows = useMemo(
    () => buildStatsChartRows(mode, monthSeries.items, yearSeries.items, searchActive),
    [mode, monthSeries.items, yearSeries.items, searchActive]
  );

  const scrollWidth = statsChartWidth(chartRows.length, active.pointWidth);

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

  const openFullscreen = useCallback(async () => {
    const inlineEl = inlineScrollRef.current;
    let scrollLeft = inlineEl?.scrollLeft ?? 0;
    if (
      inlineEl &&
      scrollLeft === 0 &&
      inlineEl.scrollWidth > inlineEl.clientWidth + 1
    ) {
      scrollLeft = inlineEl.scrollWidth - inlineEl.clientWidth;
    }
    pendingScrollLeftRef.current = scrollLeft;
    if (isCoarseMobile()) {
      await enterChartFullscreen();
    }
    setFullscreenOpen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreenOpen(false);
    void exitChartFullscreen();
  }, []);

  const handleFullscreenScrollLeftChange = useCallback((scrollLeft: number) => {
    pendingScrollLeftRef.current = scrollLeft;
  }, []);

  useEffect(() => {
    if (fullscreenOpen) return;
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
          <div style={{ minWidth: scrollWidth }} className="stats-chart-scroll-inner px-4 pt-4">
            <StatsScrollChart
              mode={mode}
              monthItems={monthSeries.items}
              yearItems={yearSeries.items}
              searchActive={searchActive}
              loading={active.loading}
              pointWidth={active.pointWidth}
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
        initialScrollLeft={pendingScrollLeftRef.current}
        onScrollLeftChange={handleFullscreenScrollLeftChange}
        scrollRef={fullscreenScrollRef}
        onScroll={active.onScroll}
        mode={mode}
        monthItems={monthSeries.items}
        yearItems={yearSeries.items}
        searchActive={searchActive}
        loading={active.loading}
        pointWidth={active.pointWidth}
        rows={chartRows}
        hiddenSeries={hiddenSeries}
        onToggleSeries={toggleSeries}
        scrollWidth={scrollWidth}
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
