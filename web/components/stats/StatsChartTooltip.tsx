'use client';

import {
  amountClassForSign,
  amountClassForType,
  type AmountColorScheme,
} from '@/lib/amountColors';
import {
  formatBalanceMoney,
  formatSignedMoney,
  formatTypedMoney,
} from '@/lib/formatMoney';

function formatTooltipValue(
  dataKey: string,
  yuan: number,
  scheme: AmountColorScheme,
  locale: string
) {
  const cents = Math.round(yuan * 100);
  switch (dataKey) {
    case 'income':
      return { text: formatTypedMoney(cents, 'income', locale), className: amountClassForType('income', scheme) };
    case 'expense':
      return { text: formatTypedMoney(cents, 'expense', locale), className: amountClassForType('expense', scheme) };
    case 'net':
      return { text: formatSignedMoney(cents, locale), className: amountClassForSign(cents, scheme) };
    case 'balance':
      return { text: formatBalanceMoney(cents, locale), className: 'text-ink font-medium' };
    default:
      return { text: formatSignedMoney(cents, locale), className: 'text-ink' };
  }
}

export type StatsChartTooltipPayload = ReadonlyArray<{
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}>;

export function StatsChartTooltip({
  active,
  payload,
  label,
  scheme,
  locale,
  seriesLabels,
}: {
  active?: boolean;
  payload?: StatsChartTooltipPayload;
  label?: string | number;
  scheme: AmountColorScheme;
  locale: string;
  seriesLabels: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-line/80 bg-surface px-3 py-2 text-xs shadow-panel">
      <p className="text-muted mb-1.5">{label}</p>
      <ul className="space-y-1">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? '');
          const yuan = Number(entry.value ?? 0);
          const { text, className } = formatTooltipValue(key, yuan, scheme, locale);
          return (
            <li key={key} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="text-muted">{seriesLabels[key] ?? key}</span>
              <span className={className}>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
