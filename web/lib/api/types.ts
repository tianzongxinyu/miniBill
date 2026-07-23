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

export type TransactionSearchFilter = {
  note?: string;
  tagIds?: number[];
  contactId?: number | null;
};

/** @deprecated use TransactionSearchFilter */
export type StatsSearchFilter = TransactionSearchFilter;

/** @deprecated use TransactionSearchFilter */
export type TransactionSearchInput = TransactionSearchFilter;

export type TransactionsPage = {
  items: Transaction[];
  next_cursor?: string | null;
  has_more: boolean;
};

export type YearMonth = { year: number; month: number };

export type SaveTransactionInput = {
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
  note: string;
  contact_id: number | null;
  tag_ids: number[];
};

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

export type AmountColorScheme = 'red_up' | 'green_up';

export type Settings = {
  locale: string;
  default_date_mode: string;
  amount_color_scheme: AmountColorScheme;
};

export type BackupInterval = 'daily' | 'weekly' | 'monthly';

export type BackupConfig = {
  enabled: boolean;
  interval: BackupInterval;
  hour: number;
  minute: number;
  weekday: number;
  month_day: number;
  keep_count: number;
  last_run_at?: string;
  last_status?: string;
  last_file?: string;
  last_error?: string;
  dir_configured: boolean;
  dir_path?: string;
};

export type BackupFileInfo = {
  filename: string;
  size: number;
  modified_at: string;
};

export type BackupFilesPage = {
  dir_configured: boolean;
  dir_path?: string;
  user_dir?: string;
  items: BackupFileInfo[];
};

export type LedgerImportResult = {
  imported_transactions: number;
  imported_balances: number;
  derived_balances: number;
  skipped_daily_expense: number;
  skipped_duplicates: number;
  created_tags: number;
  created_contacts: number;
};

export type LedgerCsvImportMapping = {
  date?: string;
  flow?: string;
  amount?: string;
  tags?: string;
  contact?: string;
  note?: string;
  balance?: string;
};

export type EditableDateRange = { min_date: string; max_date: string };

export type TagUpdate = {
  enabled?: boolean;
  color_bg?: string;
  color_fg?: string;
};

export type HomeRankingPoint = {
  year: number;
  month: number;
  total_income: number;
  total_expense: number;
};

export type HomeRankingTag = {
  id: number;
  name: string;
  color_bg: string;
  use_count: number;
  total_income: number;
  total_expense: number;
};

export type HomeRankingContact = {
  id: number;
  name: string;
  use_count: number;
  points: HomeRankingPoint[];
};

export type HomeRankings = {
  months: Array<{ year: number; month: number }>;
  tags: HomeRankingTag[];
  contacts: HomeRankingContact[];
};
