import { getCurrentYearMonth, type YearMonth } from '@/lib/api';

export type YearMonthParseFallback = 'current' | 'null';

function parseYearMonthNumbers(
  yearRaw: string | null,
  monthRaw: string | null,
  fallback: YearMonthParseFallback
): YearMonth | null {
  const y = Number(yearRaw);
  const m = Number(monthRaw);
  if (y > 0 && m >= 1 && m <= 12) return { year: y, month: m };
  if (fallback === 'current') return getCurrentYearMonth();
  return null;
}

/** 流水页：无效年月回退到当月 */
export function parseYearMonthFromQuery(params: URLSearchParams): YearMonth {
  return parseYearMonthNumbers(params.get('year'), params.get('month'), 'current')!;
}

/** 余额页：无效年月返回 null，由调用方用 resolveDefaultBalanceMonth 补默认月 */
export function parseYearMonthQuery(
  yearRaw: string | null,
  monthRaw: string | null
): YearMonth | null {
  return parseYearMonthNumbers(yearRaw, monthRaw, 'null');
}

export function safeReturnTo(raw: string | null, fallback: string): string {
  if (raw && raw.startsWith('/')) return raw;
  return fallback;
}

export type TransactionsHrefOptions = {
  year: number;
  month: number;
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
};

export function buildTransactionsHref(opts: TransactionsHrefOptions): string {
  const params = new URLSearchParams();
  params.set('year', String(opts.year));
  params.set('month', String(opts.month));
  const note = opts.note?.trim();
  if (note) params.set('note', note);
  if (opts.tagIds?.length) params.set('tags', opts.tagIds.join(','));
  if (opts.contactId != null && opts.contactId > 0) {
    params.set('contact', String(opts.contactId));
  }
  return `/transactions/?${params.toString()}`;
}

export function contactDetailHref(contactId: number, returnTo?: string): string {
  const base = `/profile/contacts/detail/?id=${contactId}`;
  if (!returnTo) return base;
  return `${base}&returnTo=${encodeURIComponent(returnTo)}`;
}

export type TransactionsFiltersFromQuery = {
  note: string;
  tagIds: number[];
  contactId: number | null;
};

export function parseTransactionsFiltersFromQuery(
  params: URLSearchParams
): TransactionsFiltersFromQuery {
  const note = params.get('note') ?? '';
  const tagsRaw = params.get('tags');
  const tagIds = tagsRaw
    ? tagsRaw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => n > 0)
    : [];
  const contactRaw = params.get('contact');
  const contactId =
    contactRaw != null && Number(contactRaw) > 0 ? Number(contactRaw) : null;
  return { note, tagIds, contactId };
}
