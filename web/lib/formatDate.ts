import type { YearMonth } from '@/lib/api';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseISODate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function formatYearMonth({ year, month }: YearMonth): string {
  return `${year}-${pad2(month)}`;
}

/** 统计图/表精简月标签：yy/MM */
export function formatYearMonthShort({ year, month }: YearMonth): string {
  return `${pad2(year % 100)}/${pad2(month)}`;
}

export function formatISODate(iso: string): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}
