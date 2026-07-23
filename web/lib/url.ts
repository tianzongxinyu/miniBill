import { getCurrentYearMonth, type YearMonth } from '@/lib/api';
import { parseISODate, toISODate } from '@/lib/formatDate';

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

export type TransactionTypeFilter = 'expense' | 'income' | null;

export function parseTransactionTypeFromQuery(params: URLSearchParams): TransactionTypeFilter {
  const raw = params.get('type');
  if (raw === 'expense' || raw === 'income') return raw;
  return null;
}

export type TransactionsHrefOptions = {
  year: number;
  month: number;
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
  type?: 'expense' | 'income';
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
  if (opts.type === 'expense' || opts.type === 'income') {
    params.set('type', opts.type);
  }
  return `/transactions/?${params.toString()}`;
}

/** 流水月默认记一笔日期：当月用今天，历史月用该月最后一天 */
export function defaultDateInMonth(year: number, month: number): string {
  const current = getCurrentYearMonth();
  if (year === current.year && month === current.month) {
    const t = new Date();
    return toISODate(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }
  const lastDay = new Date(year, month, 0).getDate();
  return toISODate(year, month, lastDay);
}

export function buildAddHref(opts: { year: number; month: number; returnTo: string }): string {
  const params = new URLSearchParams();
  params.set('date', defaultDateInMonth(opts.year, opts.month));
  params.set('returnTo', opts.returnTo);
  return `/add/?${params.toString()}`;
}

export function parseDateParam(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = toISODate(y, m, d);
  const parsed = parseISODate(iso);
  if (!parsed || parsed.y !== y || parsed.m !== m || parsed.d !== d) return null;
  return iso;
}

export type ContactDetailHrefOptions = {
  contactId: number;
  returnTo?: string;
  type?: 'expense' | 'income';
};

export function buildContactDetailHref(opts: ContactDetailHrefOptions): string {
  const params = new URLSearchParams();
  params.set('id', String(opts.contactId));
  if (opts.returnTo) params.set('returnTo', opts.returnTo);
  if (opts.type === 'expense' || opts.type === 'income') {
    params.set('type', opts.type);
  }
  return `/profile/contacts/detail/?${params.toString()}`;
}

export type TagDetailHrefOptions = {
  tagId: number;
  returnTo?: string;
  type?: 'expense' | 'income';
};

export function buildTagDetailHref(opts: TagDetailHrefOptions): string {
  const params = new URLSearchParams();
  params.set('id', String(opts.tagId));
  if (opts.returnTo) params.set('returnTo', opts.returnTo);
  if (opts.type === 'expense' || opts.type === 'income') {
    params.set('type', opts.type);
  }
  return `/profile/tags/detail/?${params.toString()}`;
}

export function contactDetailHref(contactId: number, returnTo?: string): string {
  return buildContactDetailHref({ contactId, returnTo });
}

export function transactionEditHref(txId: number, returnTo?: string): string {
  const base = `/add/?id=${txId}`;
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
