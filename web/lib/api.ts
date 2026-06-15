const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register'];
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

/** 从 localStorage 读取 JWT，无服务端 session */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('auth:logout'));
}

function isAuthFormRequest(path: string, method?: string) {
  return method?.toUpperCase() === 'POST' && AUTH_FORM_PATHS.some((p) => path.startsWith(p));
}

export type ApiOptions = RequestInit & {
  /** 401 时是否清除登录并跳转登录页，默认 true */
  authRedirect?: boolean;
};

function logoutOnUnauthorized() {
  if (typeof window === 'undefined') return;
  clearAuthToken();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login/';
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { authRedirect = true, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'omit', // 不使用 cookie / session
    });
  } catch {
    if (fetchOptions.signal?.aborted) {
      throw new ApiError('ABORTED', '请求已取消', 0);
    }
    throw new ApiError('NETWORK_ERROR', '无法连接后端，请先启动 go run ./cmd/server', 0);
  }
  if (res.status === 401 && !isAuthFormRequest(path, fetchOptions.method)) {
    if (authRedirect) logoutOnUnauthorized();
    throw new ApiError('UNAUTHORIZED', '未授权', 401);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Next.js dev proxy returns 500 with empty body when Go backend is down/restarting
    if (res.status >= 500 && !data.error) {
      throw new ApiError(
        'NETWORK_ERROR',
        '无法连接后端，请确认 go run ./cmd/server 已启动',
        res.status
      );
    }
    throw new ApiError(data.error || 'ERROR', data.message || res.statusText, res.status);
  }
  return data as T;
}

/** 列表接口：保证始终返回数组，避免 items.map 报错 */
export async function apiList<T>(path: string, options?: RequestInit): Promise<T[]> {
  try {
    const data = await api<{ items?: T[] | null }>(path, options);
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

const yuanFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 元金额格式化（千分位 + 两位小数） */
export function formatYuan(yuan: number): string {
  return yuanFormatter.format(yuan);
}

export function centsToYuan(cents: number): string {
  return formatYuan(cents / 100);
}

export function yuanToCents(yuan: string | number): number {
  return Math.round(parseFloat(String(yuan)) * 100);
}

export type User = { id: number; username: string };
export type AuthResponse = { token: string; user: User };

export type Tag = {
  id: number;
  name: string;
  is_system: boolean;
  enabled: boolean;
  selectable?: boolean;
  color_bg: string;
  color_fg: string;
  usage_count?: number;
};
export type Contact = {
  id: number;
  name: string;
  nickname: string;
  relation_group: string;
  note: string;
  phone: string;
  usage_count?: number;
};
export type TransactionTagItem = {
  id: number;
  name: string;
  color_bg: string;
  color_fg: string;
};

export type Transaction = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
  note: string;
  contact_id?: number | null;
  contact_name?: string | null;
  tag_ids?: number[];
  tags?: string[];
  tag_items?: TransactionTagItem[];
  is_system?: boolean;
};
export type Balance = {
  year: number;
  month: number;
  balance: number;
  note: string;
};
export type MonthBillSummary = {
  year: number;
  month: number;
  start_balance?: number | null;
  end_balance?: number | null;
  total_income: number;
  total_expense: number;
  net_income: number;
};

export type ThisMonthSummary = {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
};

export type Dashboard = {
  last_month: MonthBillSummary;
  this_month: ThisMonthSummary;
};

export type MonthBillItem = {
  year: number;
  month: number;
  is_current: boolean;
  balance?: number | null;
  net_income?: number | null;
  total_income: number;
  total_expense: number;
  daily_expense?: number | null;
};

export type MonthBillsResponse = {
  items: MonthBillItem[];
  next_cursor?: string | null;
  has_more: boolean;
};

export async function fetchMonthBills(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<MonthBillsResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 5));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  const data = await api<MonthBillsResponse>(`/stats/month-bills?${params}`);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    next_cursor: data?.next_cursor ?? null,
    has_more: Boolean(data?.has_more),
  };
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

export type MonthSeriesPoint = {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
  start_balance?: number | null;
  registered_balance?: number | null;
  daily_expense?: number | null;
};

export type YearSeriesPoint = {
  year: number;
  total_income: number;
  total_expense: number;
  start_balance?: number | null;
  end_balance?: number | null;
};

export type StatsSeriesPage<T> = {
  items: T[];
  older_cursor?: string | null;
  has_more_older: boolean;
  has_more_newer: boolean;
};

export type StatsSearchFilter = {
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
};

export type TransactionSearchInput = {
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
};

export function isTransactionSearchActive(input: TransactionSearchInput): boolean {
  return (
    Boolean(input.note?.trim()) ||
    Boolean(input.tagIds && input.tagIds.length > 0) ||
    input.contactId != null
  );
}

function appendStatsSearchFilter(params: URLSearchParams, filter?: StatsSearchFilter) {
  const note = filter?.note?.trim();
  if (note) params.set('note', note);
  filter?.tagIds?.forEach((id) => params.append('tag_ids', String(id)));
  if (filter?.contactId != null) params.set('contact_id', String(filter.contactId));
}

export async function fetchMonthSeries(opts?: {
  limit?: number;
  cursor?: string | null;
  after?: string | null;
  searchFilter?: StatsSearchFilter;
}): Promise<StatsSeriesPage<MonthSeriesPoint>> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 12));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.after) params.set('after', opts.after);
  appendStatsSearchFilter(params, opts?.searchFilter);
  const data = await api<StatsSeriesPage<MonthSeriesPoint>>(`/stats/month-series?${params}`);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    older_cursor: data?.older_cursor ?? null,
    has_more_older: Boolean(data?.has_more_older),
    has_more_newer: Boolean(data?.has_more_newer),
  };
}

export async function fetchYearSeries(opts?: {
  limit?: number;
  cursor?: string | null;
  after?: string | null;
  searchFilter?: StatsSearchFilter;
}): Promise<StatsSeriesPage<YearSeriesPoint>> {
  const params = new URLSearchParams();
  params.set('limit', String(opts?.limit ?? 10));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  if (opts?.after) params.set('after', opts.after);
  appendStatsSearchFilter(params, opts?.searchFilter);
  const data = await api<StatsSeriesPage<YearSeriesPoint>>(`/stats/year-series?${params}`);
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    older_cursor: data?.older_cursor ?? null,
    has_more_older: Boolean(data?.has_more_older),
    has_more_newer: Boolean(data?.has_more_newer),
  };
}

export type TransactionsPage = {
  items: Transaction[];
  next_cursor?: string | null;
  has_more: boolean;
};

export async function fetchTransactions(opts: {
  year?: number;
  month?: number;
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TransactionsPage> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 10));
  if (opts.cursor) params.set('cursor', opts.cursor);

  // 搜索模式（note/tag/contact 任一有效）时忽略 year/month，与流水页 UI 行为一致。
  const searchActive = isTransactionSearchActive({
    note: opts.note,
    tagIds: opts.tagIds,
    contactId: opts.contactId,
  });

  if (searchActive) {
    const note = opts.note?.trim();
    if (note) params.set('note', note);
    opts.tagIds?.forEach((id) => params.append('tag_ids', String(id)));
    if (opts.contactId != null) params.set('contact_id', String(opts.contactId));
  } else if (opts.year != null && opts.month != null) {
    params.set('year', String(opts.year));
    params.set('month', String(opts.month));
  }

  const data = await api<TransactionsPage>(`/transactions?${params}`, {
    signal: opts.signal,
  });
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    next_cursor: data?.next_cursor ?? null,
    has_more: Boolean(data?.has_more),
  };
}

export async function fetchUsedTransactionTags(): Promise<Tag[]> {
  return apiList<Tag>('/meta/transaction-tags');
}

export async function fetchUsedTransactionContacts(): Promise<Contact[]> {
  return apiList<Contact>('/meta/transaction-contacts');
}

export type YearMonth = { year: number; month: number };

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

export function isSameMonthAsNow(y: number, m: number): boolean {
  const now = getCurrentYearMonth();
  return now.year === y && now.month === m;
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export async function fetchEarliestMonth(): Promise<YearMonth | null> {
  const data = await api<{ year: number | null; month: number | null }>('/meta/earliest-month');
  if (data.year == null || data.month == null) return null;
  return { year: data.year, month: data.month };
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

export async function createTag(name: string): Promise<Tag> {
  return api<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) });
}

export type TagUpdate = {
  enabled?: boolean;
  color_bg?: string;
  color_fg?: string;
};

export async function updateTag(id: number, patch: TagUpdate): Promise<Tag> {
  return api<Tag>(`/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteTag(id: number): Promise<void> {
  await api(`/tags/${id}`, { method: 'DELETE' });
}

export type EditableDateRange = { min_date: string; max_date: string };

export async function fetchEditableDateRange(): Promise<EditableDateRange> {
  return api<EditableDateRange>('/meta/editable-range').catch(() => ({
    min_date: '',
    max_date: new Date().toISOString().slice(0, 10),
  }));
}

export async function fetchTransactionFormMeta(): Promise<{
  tags: Tag[];
  contacts: Contact[];
  editableRange: EditableDateRange;
}> {
  const [tags, contacts, editableRange] = await Promise.all([
    apiList<Tag>('/tags?enabled=1'),
    apiList<Contact>('/contacts'),
    fetchEditableDateRange(),
  ]);
  return { tags, contacts, editableRange };
}

export type SaveTransactionInput = {
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
  note: string;
  contact_id: number | null;
  tag_ids: number[];
};

export async function fetchTransaction(id: string | number): Promise<Transaction> {
  return api<Transaction>(`/transactions/${id}`);
}

export async function saveTransaction(
  input: SaveTransactionInput,
  editId?: string | null
): Promise<Transaction> {
  if (editId) {
    return api<Transaction>(`/transactions/${editId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }
  return api<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteTransaction(id: string | number): Promise<void> {
  await api(`/transactions/${id}`, { method: 'DELETE' });
}

export type ContactDetail = {
  id: number;
  name: string;
  social_expense: number;
  social_income: number;
  net_amount: number;
  last_transaction?: {
    id: number;
    amount: number;
    type: 'income' | 'expense';
    transaction_date: string;
  };
};

export async function fetchContactDetail(id: number): Promise<ContactDetail> {
  return api<ContactDetail>(`/contacts/${id}`);
}

export async function createContact(name: string): Promise<Contact> {
  return api<Contact>('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name,
      nickname: '',
      relation_group: '',
      note: '',
      phone: '',
    }),
  });
}

export async function deleteContact(id: number): Promise<void> {
  await api(`/contacts/${id}`, { method: 'DELETE' });
}

export type AmountColorScheme = 'red_up' | 'green_up';

export type Settings = {
  default_currency: string;
  default_date_mode: string;
  amount_color_scheme: AmountColorScheme;
};

export async function fetchSettings(): Promise<Settings> {
  return api<Settings>('/settings');
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  return api<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export type LedgerImportResult = {
  imported_transactions: number;
  imported_balances: number;
  skipped_daily_expense: number;
  created_tags: number;
  created_contacts: number;
};

export async function exportLedgerCSV(): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/ledger/export`, { headers, credentials: 'omit' });
  if (res.status === 401) {
    logoutOnUnauthorized();
    throw new ApiError('UNAUTHORIZED', '未授权', 401);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'ERROR', data.message || res.statusText, res.status);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `minibill-ledger-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLedgerCSV(file: File): Promise<LedgerImportResult> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/ledger/import`, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'omit',
  });
  if (res.status === 401) {
    logoutOnUnauthorized();
    throw new ApiError('UNAUTHORIZED', '未授权', 401);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'ERROR', data.message || res.statusText, res.status);
  }
  return data as LedgerImportResult;
}
