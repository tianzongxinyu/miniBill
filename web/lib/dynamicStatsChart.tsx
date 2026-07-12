'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/LoadingFallback';

export const StatsScrollChart = dynamic(
  () => import('@/components/stats/StatsScrollChart').then((m) => m.StatsScrollChart),
  { ssr: false, loading: () => <ChartSkeleton height={252} /> }
);

export { statsChartWidth } from '@/lib/statsChartScrollSync';
