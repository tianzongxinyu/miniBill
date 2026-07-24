'use client';

import dynamic from 'next/dynamic';
import {
  Component,
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ChartSkeleton } from '@/components/ui/LoadingFallback';

type ChartProps = ComponentProps<typeof import('@/components/stats/StatsScrollChart').StatsScrollChart>;

class ChartLoadErrorBoundary extends Component<
  { resetKey: number; fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function loadStatsScrollChart() {
  return import('@/components/stats/StatsScrollChart')
    .then((m) => m.StatsScrollChart)
    .catch((err: unknown) => {
      function ChartChunkLoadFailed(): never {
        throw err instanceof Error ? err : new Error('Failed to load chart');
      }
      return ChartChunkLoadFailed;
    });
}

/** Overlap recharts chunk download with chart API latency. */
export function prefetchStatsChart() {
  void loadStatsScrollChart();
}

const DynamicStatsScrollChart = dynamic(loadStatsScrollChart, {
  ssr: false,
  loading: () => <ChartSkeleton height={252} />,
});

export function StatsScrollChart(props: ChartProps) {
  const { t } = useTranslation();
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => {
    setRetryKey((k) => k + 1);
  }, []);

  const fallback = (
    <div
      className="flex flex-col items-center justify-center gap-2 text-sm text-muted px-4"
      style={{ height: props.height ?? 252 }}
    >
      <p>{t('common.cannotLoad')}</p>
      <button type="button" className="btn-ghost text-sm" onClick={retry}>
        {t('common.refresh')}
      </button>
    </div>
  );

  return (
    <ChartLoadErrorBoundary resetKey={retryKey} fallback={fallback}>
      <DynamicStatsScrollChart key={retryKey} {...props} />
    </ChartLoadErrorBoundary>
  );
}

export { statsChartWidth } from '@/lib/statsChartScrollSync';
