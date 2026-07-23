'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/components/SettingsProvider';
import { ChartSkeleton } from '@/components/ui/LoadingFallback';
import { HomeHotTagCapsules } from '@/components/home/HomeHotTagCapsules';
import { HomeHotContactTornado } from '@/components/home/HomeHotContactTornado';
import { StatsScrollChart } from '@/lib/dynamicStatsChart';
import {
  fetchHomeRankings,
  fetchMonthSeries,
  type HomeRankings,
  type MonthSeriesPoint,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { useOnLedgerChanged } from '@/lib/ledgerEvents';
import { buildStatsChartRows } from '@/lib/statsChartData';

type TrendMonths = 6 | 12;

const HOME_CHART_HEIGHT = 160;
const HOME_MIN_POINT_WIDTH = 36;
const HOME_HIDDEN_SERIES = new Set(['net']);
const HOME_CHART_MARGIN = { top: 8, right: 4, left: 4, bottom: 16 };
const HOME_CATEGORY_PADDING = 8;

export function HomeMiniChart({ reloadKey = 0 }: { reloadKey?: number }) {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [months, setMonths] = useState<TrendMonths>(6);
  const [containerWidth, setContainerWidth] = useState(0);
  const [items, setItems] = useState<MonthSeriesPoint[]>([]);
  const [rankings, setRankings] = useState<HomeRankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSeries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchMonthSeries({ limit: months });
      setItems(page.items);
    } catch (e) {
      setError(formatApiError(e, t('common.loadFailed')));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t, months]);

  const loadRankings = useCallback(async () => {
    try {
      const ranks = await fetchHomeRankings({ months });
      setRankings(ranks);
    } catch {
      setRankings(null);
    }
  }, [months]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries, reloadKey]);

  useEffect(() => {
    void loadRankings();
  }, [loadRankings, reloadKey]);

  useOnLedgerChanged(
    useCallback(() => {
      void loadSeries();
      void loadRankings();
    }, [loadSeries, loadRankings])
  );

  const rows = useMemo(
    () => buildStatsChartRows('month', items, [], false, locale),
    [items, locale]
  );

  const showTrend = !error && !(loading && items.length === 0) && rows.length >= 2;

  useEffect(() => {
    if (!showTrend) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.floor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTrend]);

  const { chartWidth, pointWidth } = useMemo(() => {
    const n = rows.length;
    if (n < 2) {
      return { chartWidth: 320, pointWidth: HOME_MIN_POINT_WIDTH };
    }
    if (containerWidth <= 0) {
      return { chartWidth: Math.max(n * HOME_MIN_POINT_WIDTH, 320), pointWidth: HOME_MIN_POINT_WIDTH };
    }
    const fillPw = containerWidth / n;
    const pointWidth = Math.max(HOME_MIN_POINT_WIDTH, fillPw);
    const chartWidth = Math.max(containerWidth, n * pointWidth);
    return { chartWidth, pointWidth };
  }, [rows.length, containerWidth]);

  const showTags = (rankings?.tags?.length ?? 0) > 0;
  const showContacts = (rankings?.contacts?.length ?? 0) > 0;
  const segIndex = months === 6 ? 0 : 1;

  return (
    <article className="bill-card !px-0 !py-0 overflow-hidden">
      <header className="bill-card-header flex items-center justify-between gap-3 px-4 pt-3.5 mb-0">
        <div
          className="relative grid grid-cols-2 rounded-full border border-line/50 bg-accent-soft/40 p-0.5 backdrop-blur-sm"
          role="tablist"
          aria-label={t('home.trendTitle')}
        >
          <span
            className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/2)] rounded-full bg-surface/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${segIndex * 100}%)` }}
            aria-hidden
          />
          <button
            type="button"
            role="tab"
            aria-selected={months === 6}
            className={`relative z-[1] px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-200 ${
              months === 6 ? 'text-ink' : 'text-muted/70'
            }`}
            onClick={() => setMonths(6)}
          >
            {t('home.trendHalfYear')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={months === 12}
            className={`relative z-[1] px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-200 ${
              months === 12 ? 'text-ink' : 'text-muted/70'
            }`}
            onClick={() => setMonths(12)}
          >
            {t('home.trendOneYear')}
          </button>
        </div>
        <Link href="/stats/" className="text-xs text-accent shrink-0">
          {t('home.viewStats')} ›
        </Link>
      </header>

      {error ? (
        <p className="px-4 py-6 text-sm text-muted text-center">{error}</p>
      ) : loading && items.length === 0 ? (
        <div className="px-1 pb-3.5 pt-2">
          <ChartSkeleton height={HOME_CHART_HEIGHT} />
        </div>
      ) : rows.length < 2 ? (
        <p className="px-4 py-8 text-sm text-muted text-center">{t('home.trendEmpty')}</p>
      ) : (
        <div
          ref={scrollRef}
          className="stats-chart-scroll overflow-x-auto pb-2"
          style={{ minHeight: HOME_CHART_HEIGHT }}
        >
          <div
            className="stats-chart-scroll-inner pt-2"
            style={{ minWidth: chartWidth, width: chartWidth }}
          >
            <StatsScrollChart
              mode="month"
              monthItems={items}
              yearItems={[]}
              searchActive={false}
              loading={loading}
              pointWidth={pointWidth}
              rows={rows}
              hiddenSeries={HOME_HIDDEN_SERIES}
              height={HOME_CHART_HEIGHT}
              margin={HOME_CHART_MARGIN}
              categoryPadding={HOME_CATEGORY_PADDING}
            />
          </div>
        </div>
      )}

      {!error && showContacts && (
        <HomeHotContactTornado contacts={rankings!.contacts} />
      )}
      {!error && showTags && <HomeHotTagCapsules tags={rankings!.tags} />}
    </article>
  );
}
