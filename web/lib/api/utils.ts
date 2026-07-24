import type { TransactionSearchFilter, YearMonth } from '@/lib/api/types';

export type { YearMonth };

/** 检索条件个数：每个标签 + 联系人 + 非空备注各计 1 */
export function countSearchConditions(input: TransactionSearchFilter): number {
  const tagCount = input.tagIds?.length ?? 0;
  const contactCount = input.contactId != null ? 1 : 0;
  const noteCount = input.note?.trim() ? 1 : 0;
  return tagCount + contactCount + noteCount;
}

export function isTransactionSearchActive(input: TransactionSearchFilter): boolean {
  return countSearchConditions(input) > 0;
}

export function appendSearchFilter(params: URLSearchParams, filter?: TransactionSearchFilter) {
  const note = filter?.note?.trim();
  if (note) params.set('note', note);
  filter?.tagIds?.forEach((id) => params.append('tag_ids', String(id)));
  if (filter?.contactId != null) params.set('contact_id', String(filter.contactId));
  if (filter?.tagMatch === 'any' && countSearchConditions(filter) >= 2) {
    params.set('tag_match', 'any');
  }
}

export function normalizeCursorPage<T>(data: {
  items?: T[] | null;
  next_cursor?: string | null;
  has_more?: boolean;
}): { items: T[]; next_cursor: string | null; has_more: boolean } {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    next_cursor: data?.next_cursor ?? null,
    has_more: Boolean(data?.has_more),
  };
}

/** 表单输入用：纯数字字符串，不含千分位（兼容 type="number"） */
export function centsToYuanInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function yuanToCents(yuan: string | number): number {
  return Math.round(parseFloat(String(yuan).replace(/,/g, '')) * 100);
}

export function getCurrentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function prevMonth(y: number, m: number): YearMonth {
  if (m <= 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

export function nextMonth(y: number, m: number): YearMonth {
  if (m >= 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}
