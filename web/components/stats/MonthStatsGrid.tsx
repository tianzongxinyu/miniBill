'use client';

import { MonthBillCurrentSplit, MonthBillPastStats } from '@/components/stats/MonthBillStats';
import type { MonthBillItem } from '@/lib/api';

export function MonthStatsGrid({ item }: { item: MonthBillItem }) {
  if (item.is_current) {
    return <MonthBillCurrentSplit item={item} />;
  }
  return <MonthBillPastStats item={item} variant="home" />;
}
