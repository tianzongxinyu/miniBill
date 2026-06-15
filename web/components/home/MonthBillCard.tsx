'use client';

import Link from 'next/link';
import { MonthBillItem } from '@/lib/api';
import { MonthStatsGrid } from '@/components/stats/MonthStatsGrid';

export function MonthBillCard({ item }: { item: MonthBillItem }) {
  const title = `${item.year} 年 ${item.month} 月`;

  return (
    <Link
      href={`/transactions/?year=${item.year}&month=${item.month}`}
      className="block cursor-pointer"
    >
      <article className={`bill-card ${item.is_current ? 'bill-card-current' : ''}`}>
        <header className="bill-card-header">
          <span className="bill-card-month">{title}</span>
        </header>
        <MonthStatsGrid item={item} />
      </article>
    </Link>
  );
}
