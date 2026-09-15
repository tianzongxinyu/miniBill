/** Shapes aligned with GET /api/stats/annual-report */

export type AnnualReportSummary = {
  total_income: number;
  total_expense: number;
  net_income: number;
  daily_expense: number | null;
  start_balance: number | null;
  end_balance: number | null;
};

export type AnnualReportTagStat = {
  tag_id: number | null;
  tag_name: string;
  total_income: number;
  total_expense: number;
  tx_count: number;
};

export type AnnualReportTagRankings = {
  expense_by_amount: AnnualReportTagStat[];
  expense_by_count: AnnualReportTagStat[];
  income_by_amount: AnnualReportTagStat[];
  income_by_count: AnnualReportTagStat[];
};

export type AnnualReportTopTx = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  transaction_date: string;
  note: string;
  contact_id: number | null;
  contact_name: string;
  tags: string[];
  tag_items: Array<{
    id: number;
    name: string;
    color_bg: string;
    color_fg: string;
  }>;
};

export type AnnualReportTxRankings = {
  expense: AnnualReportTopTx[];
  income: AnnualReportTopTx[];
};

export type AnnualReportContactStat = {
  contact_id: number;
  contact_name: string;
  total_income: number;
  total_expense: number;
  net_income: number;
  tx_count: number;
};

export type AnnualReportContactRankings = {
  expense_by_amount: AnnualReportContactStat[];
  expense_by_count: AnnualReportContactStat[];
  income_by_amount: AnnualReportContactStat[];
  income_by_count: AnnualReportContactStat[];
};

export type AnnualReportCompare = {
  prev_year: number;
  summary: AnnualReportSummary;
  delta_income: number;
  delta_expense: number;
  delta_net: number;
  pct_income: number | null;
  pct_expense: number | null;
  pct_net: number | null;
};

export type AnnualReportInsight = {
  key: string;
  params?: Record<string, string | number>;
};

export type AnnualReport = {
  year: number;
  summary: AnnualReportSummary;
  by_tag: AnnualReportTagRankings;
  top_transactions: AnnualReportTxRankings;
  top_contacts: AnnualReportContactRankings;
  compare: AnnualReportCompare | null;
  insights: AnnualReportInsight[];
};
