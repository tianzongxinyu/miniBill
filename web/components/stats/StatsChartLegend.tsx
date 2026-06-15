'use client';

import { useSettings } from '@/components/SettingsProvider';
import {
  BALANCE_CHART_STROKE,
  chartStrokeForType,
  NET_INCOME_CHART_STROKE,
} from '@/lib/amountColors';

const SERIES_LABELS: Record<string, string> = {
  expense: '总支出',
  income: '总收入',
  net: '净收入',
  balance: '余额',
};

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
  const { scheme } = useSettings();
  const incomeStroke = chartStrokeForType('income', scheme);
  const expenseStroke = chartStrokeForType('expense', scheme);

  const items: LegendItem[] = searchActive
    ? [
        { key: 'expense', label: SERIES_LABELS.expense, color: expenseStroke },
        { key: 'income', label: SERIES_LABELS.income, color: incomeStroke },
      ]
    : [
        { key: 'expense', label: SERIES_LABELS.expense, color: expenseStroke },
        { key: 'income', label: SERIES_LABELS.income, color: incomeStroke },
        { key: 'net', label: SERIES_LABELS.net, color: NET_INCOME_CHART_STROKE },
        { key: 'balance', label: SERIES_LABELS.balance, color: BALANCE_CHART_STROKE },
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
