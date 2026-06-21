import type { YearMonth } from '@/lib/api';
import { toIntlLocale } from '@/lib/i18n/intlLocale';

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

function localDate(y: number, m: number, d = 1): Date {
  return new Date(y, m - 1, d);
}

function dateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

function yearMonthFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    year: 'numeric',
    month: 'numeric',
  });
}

function yearMonthShortFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    year: '2-digit',
    month: 'numeric',
  });
}

export function formatYearMonth({ year, month }: YearMonth, locale: string): string {
  return yearMonthFormatter(locale).format(localDate(year, month));
}

/** 统计图/表精简月标签 */
export function formatYearMonthShort({ year, month }: YearMonth, locale: string): string {
  return yearMonthShortFormatter(locale).format(localDate(year, month));
}

export function formatISODate(iso: string, locale: string): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  return dateFormatter(locale).format(localDate(p.y, p.m, p.d));
}
