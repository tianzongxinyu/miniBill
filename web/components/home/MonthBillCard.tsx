'use client';

import Link from 'next/link';
import { MonthBillItem } from '@/lib/api';
import { formatYearMonth } from '@/lib/formatDate';
import { MonthStatsGrid } from '@/components/stats/MonthStatsGrid';

export function MonthBillCard({ item }: { item: MonthBillItem }) {
  const title = formatYearMonth({ year: item.year, month: item.month });

  return (
    <Link
      href={`/transactions/?year=${item.year}&month=${item.month}`}
      className="block cursor-pointer"
    >
      <article className={`bill-card ${item.is_current ? 'bill-card-current' : 'bill-card-past'}`}>
        <header className="bill-card-header">
          <span className="bill-card-month">{title}</span>
        </header>
        <MonthStatsGrid item={item} />
      </article>
    </Link>
  );
}
