'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Amount } from '@/components/ui/Amount';
import { SignedAmount } from '@/components/ui/SignedAmount';
import { TagChip } from '@/components/ui/TagChip';
import { formatPlainMoney } from '@/lib/formatMoney';
import { useSettings } from '@/components/SettingsProvider';
import { chartStrokeForType } from '@/lib/amountColors';
import { useFormatDate } from '@/hooks/useFormatDate';
import { contactDetailHref } from '@/lib/url';
import type { AnnualReport, AnnualReportInsight, AnnualReportTopTx } from '@/lib/annualReportTypes';

const SECTION_DELAYS = ['0ms', '60ms', '120ms', '180ms', '240ms', '300ms'] as const;
const TAG_PREVIEW_COUNT = 5;
const AXIS_BREAK_RATIO = 3;
const AXIS_BREAK_VISUAL_PCT = 72;

function brokenPct(sum: number, breakAt: number, maxSum: number): number {
  if (sum <= breakAt) return (sum / breakAt) * AXIS_BREAK_VISUAL_PCT;
  if (maxSum <= breakAt) return AXIS_BREAK_VISUAL_PCT;
  return (
    AXIS_BREAK_VISUAL_PCT +
    ((sum - breakAt) / (maxSum - breakAt)) * (100 - AXIS_BREAK_VISUAL_PCT)
  );
}

function tagAxisScale(tags: AnnualReport['by_tag']) {
  const sums = tags
    .map((x) => x.total_expense + x.total_income)
    .filter((s) => s > 0)
    .sort((a, b) => b - a);
  const maxSum = sums[0] ?? 1;
  const secondMax = sums[1] ?? 0;
  const broken = secondMax > 0 && maxSum >= AXIS_BREAK_RATIO * secondMax;
  return {
    maxSum,
    breakAt: broken ? secondMax : 0,
    broken,
  };
}

function Section({
  title,
  badge,
  children,
  delayIndex = 0,
  flush = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  delayIndex?: number;
  flush?: boolean;
}) {
  return (
    <section
      className="annual-report-section"
      style={{ animationDelay: SECTION_DELAYS[delayIndex] ?? '240ms' }}
    >
      <h2 className="annual-report-section-title">
        <span>{title}</span>
        {badge ? <span className="annual-report-section-badge">{badge}</span> : null}
      </h2>
      <div className={flush ? 'annual-report-section-body-flush' : 'annual-report-section-body'}>
        {children}
      </div>
    </section>
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

function TagBars({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();
  const { scheme } = useSettings();
  const expenseColor = chartStrokeForType('expense', scheme);
  const incomeColor = chartStrokeForType('income', scheme);
  const [expanded, setExpanded] = useState(false);
  const tags = report.by_tag;
  const { maxSum, breakAt, broken } = tagAxisScale(tags);
  const canCollapse = tags.length > TAG_PREVIEW_COUNT;
  const visible = expanded || !canCollapse ? tags : tags.slice(0, TAG_PREVIEW_COUNT);

  return (
    <div>
      <ul>
        {visible.map((row) => {
          const name = row.tag_name || t('annualReport.untagged');
          const sum = row.total_expense + row.total_income;
          const sumPct = Math.round(
            broken ? brokenPct(sum, breakAt, maxSum) : (sum / maxSum) * 100
          );
          const expenseShare =
            sum > 0 ? Math.round((row.total_expense / sum) * 100) : 0;
          const incomeShare = sum > 0 ? 100 - expenseShare : 0;
          const showBreakMark = broken && sum > breakAt;
          return (
            <li key={row.tag_id ?? 'untagged'} className="annual-report-tag-row">
              <span className="annual-report-tag-name">
                {name}
                <span className="annual-report-tag-count">
                  {t('annualReport.txCount', { count: row.tx_count })}
                </span>
              </span>
              <div className="annual-report-row-amount">
                {row.total_expense > 0 ? (
                  <Amount
                    cents={row.total_expense}
                    type="expense"
                    className="annual-report-row-amount-primary"
                  />
                ) : row.total_income > 0 ? (
                  <Amount
                    cents={row.total_income}
                    type="income"
                    className="annual-report-row-amount-primary"
                  />
                ) : null}
                {row.total_expense > 0 && row.total_income > 0 && (
                  <span className="annual-report-row-amount-secondary">
                    <Amount
                      cents={row.total_income}
                      type="income"
                      className="annual-report-row-amount-secondary"
                    />
                  </span>
                )}
              </div>
              {sum > 0 && (
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
                    {row.total_expense > 0 && (
                      <div
                        className="annual-report-tag-bar-fill"
                        style={{
                          width: `${expenseShare}%`,
                          backgroundColor: expenseColor,
                        }}
                      />
                    )}
                    {row.total_income > 0 && (
                      <div
                        className="annual-report-tag-bar-fill-income"
                        style={{
                          width: `${incomeShare}%`,
                          backgroundColor: incomeColor,
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {canCollapse && (
        <button
          type="button"
          className="annual-report-expand"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? t('annualReport.collapseTags')
            : t('annualReport.expandTags', { count: tags.length })}
        </button>
      )}
    </div>
  );
}

function TopTxList({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();
  const { formatISODate } = useFormatDate();
  const returnTo = `/stats/annual/?year=${report.year}`;

  return (
    <ol>
      {report.top_transactions.map((tx, i) => (
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

function TopContactsList({ report }: { report: AnnualReport }) {
  const { t } = useTranslation();

  if (report.top_contacts.length === 0) {
    return <p className="text-sm text-muted px-4 py-3">{t('annualReport.noContacts')}</p>;
  }

  return (
    <ol>
      {report.top_contacts.map((c, i) => (
        <li key={c.contact_id} className="annual-report-row">
          <span className="annual-report-rank">{i + 1}</span>
          <div className="annual-report-row-main">
            <div className="annual-report-row-title">{c.contact_name}</div>
            <div className="annual-report-row-meta">
              {t('annualReport.txCount', { count: c.tx_count })}
            </div>
          </div>
          <div className="annual-report-row-amount">
            <SignedAmount cents={c.net_income} className="annual-report-row-amount-primary" />
            {(c.total_income > 0 || c.total_expense > 0) && (
              <div className="annual-report-row-amount-secondary flex items-center justify-end gap-1">
                {c.total_expense > 0 && (
                  <Amount cents={c.total_expense} type="expense" className="text-[11px]" />
                )}
                {c.total_expense > 0 && c.total_income > 0 && (
                  <span className="text-muted/70" aria-hidden>
                    /
                  </span>
                )}
                {c.total_income > 0 && (
                  <Amount cents={c.total_income} type="income" className="text-[11px]" />
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
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
              <span className="annual-report-compare-prev">
                {c.prev_year} {formatPlainMoney(row.prev, locale)}
              </span>
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

  return (
    <div className="annual-report">
      <SummaryHero report={report} />

      <Section title={t('annualReport.sectionByTag')} delayIndex={1} flush>
        <TagBars report={report} />
      </Section>

      <Section title={t('annualReport.sectionTopTx')} delayIndex={2} flush>
        <TopTxList report={report} />
      </Section>

      <Section title={t('annualReport.sectionTopContacts')} delayIndex={3} flush>
        <TopContactsList report={report} />
      </Section>

      <Section title={t('annualReport.sectionCompare')} delayIndex={4}>
        <CompareBlock report={report} />
      </Section>

      <Section title={t('annualReport.sectionInsights')} delayIndex={5}>
        <ul className="annual-report-insight-list">
          {report.insights.map((insight) => (
            <InsightText key={insight.key} insight={insight} />
          ))}
        </ul>
      </Section>
    </div>
  );
}
