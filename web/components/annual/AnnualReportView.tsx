'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { TagChip } from '@/components/ui/TagChip';
import { formatPlainMoney, formatSignedMoney, formatTypedMoney } from '@/lib/formatMoney';
import { useSettings } from '@/components/SettingsProvider';
import { chartStrokeForType } from '@/lib/amountColors';
import { useFormatDate } from '@/hooks/useFormatDate';
import { contactDetailHref } from '@/lib/url';
import type {
  AnnualReport,
  AnnualReportContactStat,
  AnnualReportInsight,
  AnnualReportTagStat,
  AnnualReportTopTx,
} from '@/lib/annualReportTypes';

const SECTION_DELAYS = ['0ms', '60ms', '120ms', '180ms', '240ms', '300ms', '360ms'] as const;
const AXIS_BREAK_RATIO = 3;
const AXIS_BREAK_VISUAL_PCT = 72;

type FlowType = 'expense' | 'income';

function brokenPct(sum: number, breakAt: number, maxSum: number): number {
  if (sum <= breakAt) return (sum / breakAt) * AXIS_BREAK_VISUAL_PCT;
  if (maxSum <= breakAt) return AXIS_BREAK_VISUAL_PCT;
  return (
    AXIS_BREAK_VISUAL_PCT +
    ((sum - breakAt) / (maxSum - breakAt)) * (100 - AXIS_BREAK_VISUAL_PCT)
  );
}

/** Scale bar widths from totals; break axis when max ≥ ratio × second-max. */
function axisScaleFromSums(rawSums: number[]) {
  const sums = rawSums.filter((s) => s > 0).sort((a, b) => b - a);
  const maxSum = sums[0] ?? 1;
  const secondMax = sums[1] ?? 0;
  const broken = secondMax > 0 && maxSum >= AXIS_BREAK_RATIO * secondMax;
  return {
    maxSum,
    breakAt: broken ? secondMax : 0,
    broken,
  };
}

function defaultFlow(expenseLen: number, incomeLen: number): FlowType {
  if (expenseLen > 0) return 'expense';
  if (incomeLen > 0) return 'income';
  return 'expense';
}

function Section({
  title,
  badge,
  children,
  delayIndex = 0,
  flush = false,
  tabs,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  delayIndex?: number;
  flush?: boolean;
  tabs?: React.ReactNode;
}) {
  return (
    <section
      className="annual-report-section"
      style={{ animationDelay: SECTION_DELAYS[delayIndex] ?? '240ms' }}
    >
      <h2 className="annual-report-section-title">
        <span>{title}</span>
        {badge ? <span className="annual-report-section-badge">{badge}</span> : null}
        {tabs ? <span className="annual-report-section-tabs">{tabs}</span> : null}
      </h2>
      <div className={flush ? 'annual-report-section-body-flush' : 'annual-report-section-body'}>
        {children}
      </div>
    </section>
  );
}

function TypeTabs({
  value,
  onChange,
  expenseDisabled,
  incomeDisabled,
}: {
  value: FlowType;
  onChange: (v: FlowType) => void;
  expenseDisabled?: boolean;
  incomeDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className="annual-report-type-tabs" role="group">
      <button
        type="button"
        className={value === 'expense' ? 'btn-segment-active' : 'btn-segment'}
        disabled={expenseDisabled}
        onClick={() => onChange('expense')}
      >
        {t('stats.expense')}
      </button>
      <button
        type="button"
        className={value === 'income' ? 'btn-segment-active' : 'btn-segment'}
        disabled={incomeDisabled}
        onClick={() => onChange('income')}
      >
        {t('stats.income')}
      </button>
    </span>
  );
}

function SummaryHero({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();
  const { summary } = report;

  return (
    <article className="annual-report-hero" style={{ animationDelay: '0ms' }}>
      <div className="annual-report-hero-split">
        <div className="annual-report-hero-stat">
          <div className="annual-report-hero-stat-label">{t('stats.totalIncome')}</div>
          <div className="annual-report-hero-stat-value">
            <Amount cents={summary.total_income} type="income" className="annual-report-hero-stat-value" />
          </div>
        </div>
        <div className="annual-report-hero-stat">
          <div className="annual-report-hero-stat-label">{t('stats.totalExpense')}</div>
          <div className="annual-report-hero-stat-value">
            <Amount cents={summary.total_expense} type="expense" className="annual-report-hero-stat-value" />
          </div>
        </div>
      </div>

      <div className="annual-report-hero-net">
        <span className="annual-report-hero-net-label">{t('stats.netIncome')}</span>
        <SignedAmount cents={summary.net_income} className="annual-report-hero-net-value" />
      </div>

      {(summary.daily_expense != null ||
        summary.start_balance != null ||
        summary.end_balance != null) && (
        <div className="annual-report-hero-meta">
          {summary.daily_expense != null && (
            <div className="annual-report-kv">
              <span className="annual-report-kv-label">{t('annualReport.dailyExpense')}</span>
              <span className="annual-report-kv-value">
                <Amount cents={summary.daily_expense} type="expense" className="annual-report-kv-value" />
              </span>
            </div>
          )}
          {summary.start_balance != null && (
            <div className="annual-report-kv">
              <span className="annual-report-kv-label">{t('annualReport.startBalance')}</span>
              <span className="annual-report-kv-value">
                <Amount cents={summary.start_balance} showSign={false} className="annual-report-kv-value" />
              </span>
            </div>
          )}
          {summary.end_balance != null && (
            <div className="annual-report-kv">
              <span className="annual-report-kv-label">{t('annualReport.endBalance')}</span>
              <span className="annual-report-kv-value">
                <Amount cents={summary.end_balance} showSign={false} className="annual-report-kv-value" />
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function TagRankSection({
  title,
  expenseRows,
  incomeRows,
  delayIndex,
}: {
  title: string;
  expenseRows: AnnualReportTagStat[];
  incomeRows: AnnualReportTagStat[];
  delayIndex: number;
}) {
  const { t } = useTranslation();
  const { scheme } = useSettings();
  const [flow, setFlow] = useState<FlowType>(() =>
    defaultFlow(expenseRows.length, incomeRows.length)
  );
  if (expenseRows.length === 0 && incomeRows.length === 0) return null;

  const rows = flow === 'expense' ? expenseRows : incomeRows;
  const barColor = chartStrokeForType(flow, scheme);
  const { maxSum, breakAt, broken } = axisScaleFromSums(
    rows.map((r) => (flow === 'expense' ? r.total_expense : r.total_income))
  );

  return (
    <Section
      title={title}
      delayIndex={delayIndex}
      flush
      tabs={
        <TypeTabs
          value={flow}
          onChange={setFlow}
          expenseDisabled={expenseRows.length === 0}
          incomeDisabled={incomeRows.length === 0}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted px-4 py-3">{t('annualReport.emptyRank')}</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const name = row.tag_name || t('annualReport.untagged');
            const amount = flow === 'expense' ? row.total_expense : row.total_income;
            const sumPct = Math.round(
              broken ? brokenPct(amount, breakAt, maxSum) : (amount / maxSum) * 100
            );
            const showBreakMark = broken && amount > breakAt;
            return (
              <li key={row.tag_id ?? name} className="annual-report-tag-row">
                <span className="annual-report-tag-name">
                  {name}
                  <span className="annual-report-tag-count">
                    {t('annualReport.txCount', { count: row.tx_count })}
                  </span>
                </span>
                <div className="annual-report-row-amount">
                  <Amount
                    cents={amount}
                    type={flow}
                    className="annual-report-row-amount-primary"
                  />
                </div>
                {amount > 0 && (
                  <div
                    className={[
                      'annual-report-tag-bar-track',
                      showBreakMark && 'annual-report-tag-bar-track-broken',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div
                      className="annual-report-tag-bar-stack"
                      style={{ width: `${sumPct}%` }}
                    >
                      <div
                        className="annual-report-tag-bar-fill"
                        style={{ width: '100%', backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function TopTxMeta({ tx, returnTo }: { tx: AnnualReportTopTx; returnTo: string }) {
  const { t } = useTranslation();
  const items = tx.tag_items?.length
    ? tx.tag_items
    : (tx.tags ?? []).map((name) => ({ id: 0, name, color_bg: '', color_fg: '' }));
  const hasContact = Boolean(tx.contact_id && tx.contact_name);
  const hasMeta = items.length > 0 || hasContact;

  if (!hasMeta) {
    return <span className="text-ink">{t('common.emDash')}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((tag) => (
        <TagChip key={tag.id ? tag.id : tag.name} name={tag.name} colorBg={tag.color_bg} />
      ))}
      {hasContact && tx.contact_id != null ? (
        <Link
          href={contactDetailHref(tx.contact_id, returnTo)}
          className="text-sm text-accent hover:underline shrink-0"
        >
          @{tx.contact_name}
        </Link>
      ) : null}
    </div>
  );
}

function TopTxSection({ report, delayIndex }: { report: AnnualReport; delayIndex: number }) {
  const { t } = useTranslation();
  const { formatISODate } = useFormatDate();
  const expense = report.top_transactions.expense;
  const income = report.top_transactions.income;
  const [flow, setFlow] = useState<FlowType>(() => defaultFlow(expense.length, income.length));
  if (expense.length === 0 && income.length === 0) return null;

  const rows = flow === 'expense' ? expense : income;
  const returnTo = `/stats/annual/?year=${report.year}`;

  return (
    <Section
      title={t('annualReport.sectionTopTx')}
      delayIndex={delayIndex}
      flush
      tabs={
        <TypeTabs
          value={flow}
          onChange={setFlow}
          expenseDisabled={expense.length === 0}
          incomeDisabled={income.length === 0}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted px-4 py-3">{t('annualReport.emptyRank')}</p>
      ) : (
        <ol>
          {rows.map((tx, i) => (
            <li key={tx.id} className="annual-report-row">
              <span className="annual-report-rank">{i + 1}</span>
              <div className="annual-report-row-main">
                <div className="annual-report-row-meta !mt-0">
                  <span className="tabular-nums">{formatISODate(tx.transaction_date)}</span>
                </div>
                <div className="annual-report-row-title !mt-1">
                  <TopTxMeta tx={tx} returnTo={returnTo} />
                </div>
              </div>
              <div className="annual-report-row-amount">
                <Amount cents={tx.amount} type={tx.type} className="annual-report-row-amount-primary" />
                {tx.note ? (
                  <div className="annual-report-row-amount-secondary text-muted truncate">
                    {tx.note}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function ContactRankSection({
  title,
  expenseRows,
  incomeRows,
  delayIndex,
}: {
  title: string;
  expenseRows: AnnualReportContactStat[];
  incomeRows: AnnualReportContactStat[];
  delayIndex: number;
}) {
  const { t } = useTranslation();
  const { scheme } = useSettings();
  const [flow, setFlow] = useState<FlowType>(() =>
    defaultFlow(expenseRows.length, incomeRows.length)
  );
  if (expenseRows.length === 0 && incomeRows.length === 0) return null;

  const rows = flow === 'expense' ? expenseRows : incomeRows;
  const barColor = chartStrokeForType(flow, scheme);
  const { maxSum, breakAt, broken } = axisScaleFromSums(
    rows.map((c) => (flow === 'expense' ? c.total_expense : c.total_income))
  );

  return (
    <Section
      title={title}
      delayIndex={delayIndex}
      flush
      tabs={
        <TypeTabs
          value={flow}
          onChange={setFlow}
          expenseDisabled={expenseRows.length === 0}
          incomeDisabled={incomeRows.length === 0}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted px-4 py-3">{t('annualReport.noContacts')}</p>
      ) : (
        <ol>
          {rows.map((c, i) => {
            const amount = flow === 'expense' ? c.total_expense : c.total_income;
            const sumPct = Math.round(
              broken ? brokenPct(amount, breakAt, maxSum) : (amount / maxSum) * 100
            );
            const showBreakMark = broken && amount > breakAt;
            return (
              <li key={c.contact_id} className="annual-report-row">
                <span className="annual-report-rank">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="annual-report-row-title min-w-0 flex-1">
                      {c.contact_name}
                      <span className="annual-report-tag-count">
                        {t('annualReport.txCount', { count: c.tx_count })}
                      </span>
                    </span>
                    <div className="annual-report-row-amount">
                      <Amount
                        cents={amount}
                        type={flow}
                        className="annual-report-row-amount-primary"
                      />
                    </div>
                  </div>
                  {amount > 0 && (
                    <div
                      className={[
                        'annual-report-tag-bar-track !col-span-1 min-w-0',
                        showBreakMark && 'annual-report-tag-bar-track-broken',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div
                        className="annual-report-tag-bar-stack"
                        style={{ width: `${sumPct}%` }}
                      >
                        <div
                          className="annual-report-tag-bar-fill"
                          style={{ width: '100%', backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function formatPct(pct: number | null, locale: string): string {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

/** Income/net: up=good (income color). Expense: up=bad (expense color). */
function deltaClass(delta: number, kind: 'income' | 'expense' | 'net'): string {
  if (delta === 0) return 'text-muted';
  const up = delta > 0;
  if (kind === 'expense') return up ? 'text-expense' : 'text-income';
  return up ? 'text-income' : 'text-expense';
}

function CompareBlock({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const c = report.compare;
  if (!c) {
    return <p className="text-sm text-muted">{t('annualReport.noCompare')}</p>;
  }

  const rows: {
    label: string;
    curr: number;
    prev: number;
    delta: number;
    pct: number | null;
    kind: 'income' | 'expense' | 'net';
  }[] = [
    {
      label: t('stats.totalIncome'),
      curr: report.summary.total_income,
      prev: c.summary.total_income,
      delta: c.delta_income,
      pct: c.pct_income,
      kind: 'income',
    },
    {
      label: t('stats.totalExpense'),
      curr: report.summary.total_expense,
      prev: c.summary.total_expense,
      delta: c.delta_expense,
      pct: c.pct_expense,
      kind: 'expense',
    },
    {
      label: t('stats.netIncome'),
      curr: report.summary.net_income,
      prev: c.summary.net_income,
      delta: c.delta_net,
      pct: c.pct_net,
      kind: 'net',
    },
  ];

  return (
    <div className="annual-report-compare">
      <p className="annual-report-compare-hint">
        {t('annualReport.compareWith', { year: c.prev_year })}
      </p>
      <ul>
        {rows.map((row) => (
          <li
            key={row.label}
            className={
              row.kind === 'net'
                ? 'annual-report-compare-row annual-report-compare-row-net'
                : 'annual-report-compare-row'
            }
          >
            <div className="annual-report-compare-label">{row.label}</div>
            <div className="annual-report-compare-curr">
              <div className="annual-report-compare-value">
                {row.kind === 'net' ? (
                  <SignedAmount cents={row.curr} className="annual-report-compare-value" />
                ) : (
                  <Amount cents={row.curr} type={row.kind} className="annual-report-compare-value" />
                )}
              </div>
              <div className="annual-report-compare-prev">
                <span className="annual-report-compare-prev-value">
                  {row.kind === 'net'
                    ? formatSignedMoney(row.prev, locale)
                    : formatTypedMoney(row.prev, row.kind, locale)}
                </span>
              </div>
            </div>
            <div className="annual-report-compare-delta">
              <span className={`annual-report-compare-delta-amt ${deltaClass(row.delta, row.kind)}`}>
                {row.delta >= 0 ? '+' : '−'}
                {formatPlainMoney(Math.abs(row.delta), locale)}
              </span>
              <span className="annual-report-compare-delta-pct">{formatPct(row.pct, locale)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsightText({ insight }: { insight: AnnualReportInsight }) {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const raw = insight.params ?? {};
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' || typeof v === 'number') params[k] = v;
  }
  if (typeof raw.amount === 'number') {
    params.amount = formatPlainMoney(raw.amount, locale);
  }

  return (
    <li className="annual-report-insight">
      {t(`annualReport.insights.${insight.key}`, params)}
    </li>
  );
}

export function AnnualReportView({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();
  const tags = report.by_tag;
  const contacts = report.top_contacts;

  return (
    <div className="annual-report">
      <SummaryHero report={report} />

      <TagRankSection
        key={`tag-amt-${report.year}`}
        title={t('annualReport.sectionTagByAmount')}
        expenseRows={tags.expense_by_amount}
        incomeRows={tags.income_by_amount}
        delayIndex={1}
      />
      <TagRankSection
        key={`tag-cnt-${report.year}`}
        title={t('annualReport.sectionTagByCount')}
        expenseRows={tags.expense_by_count}
        incomeRows={tags.income_by_count}
        delayIndex={2}
      />

      <TopTxSection key={`tx-${report.year}`} report={report} delayIndex={3} />

      <ContactRankSection
        key={`ct-amt-${report.year}`}
        title={t('annualReport.sectionContactByAmount')}
        expenseRows={contacts.expense_by_amount}
        incomeRows={contacts.income_by_amount}
        delayIndex={4}
      />
      <ContactRankSection
        key={`ct-cnt-${report.year}`}
        title={t('annualReport.sectionContactByCount')}
        expenseRows={contacts.expense_by_count}
        incomeRows={contacts.income_by_count}
        delayIndex={5}
      />

      <Section title={t('annualReport.sectionCompare')} delayIndex={6}>
        <CompareBlock report={report} />
      </Section>

      <Section title={t('annualReport.sectionInsights')} delayIndex={6}>
        <ul className="annual-report-insight-list">
          {report.insights.map((insight) => (
            <InsightText key={insight.key} insight={insight} />
          ))}
        </ul>
      </Section>
    </div>
  );
}
