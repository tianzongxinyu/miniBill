import { api, ApiError, type ApiOptions } from '@/lib/api/http';
import type { AnnualReport } from '@/lib/annualReportTypes';
import type {
  Balance,
  HomeRankings,
  MonthBillItem,
  MonthBillsResponse,
  MonthSeriesPoint,
  StatsSeriesPage,
  TransactionSearchFilter,
  YearSeriesPoint,
} from '@/lib/api/types';
import { appendSearchFilter, normalizeCursorPage, yuanToCents } from '@/lib/api/utils';

function normalizeStatsSeriesPage<T>(data: StatsSeriesPage<T>): StatsSeriesPage<T> {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    older_cursor: data?.older_cursor ?? null,
    has_more_older: Boolean(data?.has_more_older),
    has_more_newer: Boolean(data?.has_more_newer),
  };
}

async function fetchStatsSeries<T>(
  path: string,
  opts?: {
    limit?: number;
    cursor?: string | null;
    after?: string | null;
    searchFilter?: TransactionSearchFilter;
  }
): Promise<StatsSeriesPage<T>> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 12));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.after) params.set('after', opts.after);
  appendSearchFilter(params, opts?.searchFilter);
  const data = await api<StatsSeriesPage<T>>(`${path}?${params}`);
  return normalizeStatsSeriesPage(data);
}

export async function fetchMonthBills(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<MonthBillsResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 5));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  const data = await api<MonthBillsResponse>(`/stats/month-bills?${params}`);
  return normalizeCursorPage(data);
}

export async function fetchMonthBill(
  year: number,
  month: number,
  options?: Pick<ApiOptions, 'signal'>
): Promise<MonthBillItem> {
  const params = new URLSearchParams();
  params.set('year', String(year));
  params.set('month', String(month));
  return api<MonthBillItem>(`/stats/month-bill?${params}`, {
    ...options,
    authRedirect: false,
  });
}

export async function fetchMonthSeries(opts?: {
  limit?: number;
  cursor?: string | null;
  after?: string | null;
  searchFilter?: TransactionSearchFilter;
}): Promise<StatsSeriesPage<MonthSeriesPoint>> {
  return fetchStatsSeries<MonthSeriesPoint>('/stats/month-series', opts);
}

export async function fetchYearSeries(opts?: {
  limit?: number;
  cursor?: string | null;
  after?: string | null;
  searchFilter?: TransactionSearchFilter;
}): Promise<StatsSeriesPage<YearSeriesPoint>> {
  return fetchStatsSeries<YearSeriesPoint>('/stats/year-series', { ...opts, limit: opts?.limit ?? 10 });
}

export async function fetchHomeRankings(opts?: {
  months?: number;
}): Promise<HomeRankings> {
  const params = new URLSearchParams();
  params.set('months', String(opts?.months ?? 6));
  const data = await api<HomeRankings>(`/stats/home-rankings?${params}`);
  const months = Array.isArray(data?.months) ? data.months : [];
  const tags = (Array.isArray(data?.tags) ? data.tags : []).map((tag) => ({
    ...tag,
    points: Array.isArray(tag.points) ? tag.points : [],
  }));
  const contacts = (Array.isArray(data?.contacts) ? data.contacts : []).map((c) => ({
    ...c,
    points: Array.isArray(c.points) ? c.points : [],
  }));
  return { months, tags, contacts };
}

export async function fetchAnnualReport(year: number): Promise<AnnualReport> {
  const params = new URLSearchParams();
  params.set('year', String(year));
  return api<AnnualReport>(`/stats/annual-report?${params}`);
}

export async function fetchAnnualDefaultYear(): Promise<number> {
  const data = await api<{ year: number }>('/stats/annual-default-year');
  return data.year;
}

export async function fetchMonthlyBalance(
  year: number,
  month: number
): Promise<Balance | null> {
  try {
    return await api<Balance>(`/monthly-balances/${year}/${month}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function upsertMonthlyBalance(
  year: number,
  month: number,
  balanceYuan: string | number,
  note: string
): Promise<Balance> {
  return api<Balance>(`/monthly-balances/${year}/${month}`, {
    method: 'PUT',
    body: JSON.stringify({ balance: yuanToCents(balanceYuan), note }),
  });
}
