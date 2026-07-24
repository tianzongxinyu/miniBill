import { downloadBlob, parseExportFilename } from '@/lib/downloadFile';
import { notifyLedgerMetaChanged } from '@/lib/ledgerEvents';
import { getToken } from '@/lib/api/auth';
import { api, apiList, apiRaw, ApiError, logoutOnUnauthorized } from '@/lib/api/http';
import type {
  BackupConfig,
  BackupFilesPage,
  BackupInterval,
  Contact,
  ContactDetail,
  ContactUpdate,
  EditableDateRange,
  LedgerImportResult,
  LedgerCsvImportMapping,
  SaveTransactionInput,
  Settings,
  Tag,
  TagDetail,
  TagUpdate,
  Transaction,
  TransactionsPage,
} from '@/lib/api/types';
import {
  appendSearchFilter,
  isTransactionSearchActive,
  normalizeCursorPage,
} from '@/lib/api/utils';
import type { YearMonth } from '@/lib/api/types';
import i18n from '@/src/i18n';

/** 流水页按月份浏览：单次拉取上限（与后端 listByCursorPage cap 一致） */
export const TRANSACTIONS_MONTH_LIMIT = 9999;

/** 流水页搜索模式：游标分页每页条数 */
export const TRANSACTIONS_SEARCH_PAGE_SIZE = 10;

export async function fetchTransactions(opts: {
  year?: number;
  month?: number;
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
  tagMatch?: 'all' | 'any';
  type?: 'expense' | 'income';
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TransactionsPage> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 10));
  if (opts.cursor) params.set('cursor', opts.cursor);

  const searchActive = isTransactionSearchActive({
    note: opts.note,
    tagIds: opts.tagIds,
    contactId: opts.contactId,
  });

  if (searchActive) {
    appendSearchFilter(params, {
      note: opts.note,
      tagIds: opts.tagIds,
      contactId: opts.contactId,
      tagMatch: opts.tagMatch,
    });
  } else if (opts.year != null && opts.month != null) {
    params.set('year', String(opts.year));
    params.set('month', String(opts.month));
  }

  if (opts.type === 'expense' || opts.type === 'income') {
    params.set('type', opts.type);
  }

  const data = await api<TransactionsPage>(`/transactions?${params}`, {
    signal: opts.signal,
  });
  return normalizeCursorPage(data);
}

export async function fetchUsedTransactionTags(): Promise<Tag[]> {
  return apiList<Tag>('/meta/transaction-tags');
}

export async function fetchUsedTransactionContacts(): Promise<Contact[]> {
  return apiList<Contact>('/meta/transaction-contacts');
}

export async function fetchEarliestMonth(): Promise<YearMonth | null> {
  const data = await api<{ year: number | null; month: number | null }>('/meta/earliest-month');
  if (data.year == null || data.month == null) return null;
  return { year: data.year, month: data.month };
}

export async function createTag(name: string): Promise<Tag> {
  const tag = await api<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) });
  notifyLedgerMetaChanged();
  return tag;
}

export async function updateTag(id: number, patch: TagUpdate): Promise<Tag> {
  const tag = await api<Tag>(`/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  notifyLedgerMetaChanged();
  return tag;
}

export async function deleteTag(id: number): Promise<void> {
  await api(`/tags/${id}`, { method: 'DELETE' });
  notifyLedgerMetaChanged();
}

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
    apiList<Contact>('/contacts?enabled=1'),
    fetchEditableDateRange(),
  ]);
  return { tags, contacts, editableRange };
}

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

export async function fetchContactDetail(id: number): Promise<ContactDetail> {
  return api<ContactDetail>(`/contacts/${id}`);
}

export async function fetchTagDetail(id: number): Promise<TagDetail> {
  return api<TagDetail>(`/tags/${id}`);
}

export async function createContact(name: string): Promise<Contact> {
  const contact = await api<Contact>('/contacts', {
    method: 'POST',
    body: JSON.stringify({
      name,
      nickname: '',
      relation_group: '',
      note: '',
      phone: '',
    }),
  });
  notifyLedgerMetaChanged();
  return contact;
}

export async function updateContact(id: number, patch: ContactUpdate): Promise<Contact> {
  const contact = await api<Contact>(`/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  notifyLedgerMetaChanged();
  return contact;
}

export async function deleteContact(id: number): Promise<void> {
  await api(`/contacts/${id}`, { method: 'DELETE' });
  notifyLedgerMetaChanged();
}

export async function fetchSettings(): Promise<Settings> {
  return api<Settings>('/settings');
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  return api<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function fetchBackup(): Promise<BackupConfig> {
  return api<BackupConfig>('/backup');
}

export async function updateBackup(patch: {
  enabled: boolean;
  interval: BackupInterval;
  hour: number;
  minute: number;
  weekday: number;
  month_day: number;
  keep_count: number;
}): Promise<BackupConfig> {
  return api<BackupConfig>('/backup', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function runBackupNow(): Promise<{ filename: string }> {
  return api<{ filename: string }>('/backup/run', { method: 'POST' });
}

export async function fetchBackupFiles(): Promise<BackupFilesPage> {
  const data = await api<BackupFilesPage>('/backup/files');
  return {
    dir_configured: Boolean(data?.dir_configured),
    dir_path: data?.dir_path,
    user_dir: data?.user_dir,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

export async function restoreFromBackup(filename: string): Promise<LedgerImportResult> {
  return api<LedgerImportResult>('/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ filename }),
  });
}

function exportFallbackFilename(): string {
  return `minibill-ledger-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
}

async function fetchExportResponse(): Promise<Response> {
  return apiRaw('/ledger/export');
}

export async function exportLedgerCSV(): Promise<void> {
  if (!getToken()) {
    logoutOnUnauthorized();
    throw new ApiError('UNAUTHORIZED', i18n.t('error.unauthorized'), 401);
  }

  const res = await fetchExportResponse();
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const filename = parseExportFilename(disposition, exportFallbackFilename());

  downloadBlob(blob, filename);
}

export async function importLedgerCSV(
  file: File,
  opts?: {
    mapping?: LedgerCsvImportMapping;
    keepHistory?: boolean;
    deriveBalances?: boolean;
    openingBalance?: string;
  }
): Promise<LedgerImportResult> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.mapping) {
    form.append('mapping', JSON.stringify(opts.mapping));
  }
  if (opts?.keepHistory) {
    form.append('keep_history', 'true');
  }
  if (opts?.deriveBalances) {
    form.append('derive_balances', 'true');
    if (opts.openingBalance != null && opts.openingBalance !== '') {
      form.append('opening_balance', opts.openingBalance);
    }
  }

  const res = await apiRaw('/ledger/import', { method: 'POST', body: form });
  return (await res.json()) as LedgerImportResult;
}
