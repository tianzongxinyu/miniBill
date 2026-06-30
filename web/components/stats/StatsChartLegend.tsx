'use client';

import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from 'react-i18next';
import {
  BALANCE_CHART_STROKE,
  chartStrokeForType,
  NET_INCOME_CHART_STROKE,
} from '@/lib/amountColors';

type LegendItem = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
};

export function StatsChartLegend({
  searchActive,
  hiddenSeries,
  onToggleSeries,
}: {
  searchActive: boolean;
  hiddenSeries: Set<string>;
  onToggleSeries: (dataKey: string) => void;
}) {
  const { t } = useTranslation();
  const { scheme } = useSettings();
  const incomeStroke = chartStrokeForType('income', scheme);
  const expenseStroke = chartStrokeForType('expense', scheme);

  const items: LegendItem[] = searchActive
    ? [
        { key: 'expense', label: t('stats.totalExpense'), color: expenseStroke },
        { key: 'income', label: t('stats.totalIncome'), color: incomeStroke },
      ]
    : [
        { key: 'expense', label: t('stats.totalExpense'), color: expenseStroke },
        { key: 'income', label: t('stats.totalIncome'), color: incomeStroke },
        { key: 'net', label: t('stats.netIncome'), color: NET_INCOME_CHART_STROKE, dashed: true },
        { key: 'balance', label: t('stats.balance'), color: BALANCE_CHART_STROKE, dashed: true },
      ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 pb-4 pt-2 border-t border-line/60 text-xs">
      {items.map((item) => {
        const hidden = hiddenSeries.has(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggleSeries(item.key)}
            className={`inline-flex items-center gap-1.5 cursor-pointer select-none transition-opacity ${
              hidden ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {item.dashed ? (
              <span
                className="inline-block w-4 shrink-0 border-t-2 border-dashed"
                style={{ borderColor: item.color }}
                aria-hidden
              />
            ) : (
              <span
                className="inline-block w-4 h-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
            )}
            <span className={hidden ? 'text-muted line-through' : 'text-ink'}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
