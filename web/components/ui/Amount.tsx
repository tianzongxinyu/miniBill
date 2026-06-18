'use client';

import { useSettings } from '@/components/SettingsProvider';
import { amountClassForType } from '@/lib/amountColors';
import { formatPlainMoney, formatTypedMoney } from '@/lib/formatMoney';

/** 只读展示：收入/支出流水与汇总（不含余额） */
export function Amount({
  cents,
  type,
  showSign = true,
  className = '',
}: {
  cents: number;
  type?: 'income' | 'expense';
  showSign?: boolean;
  className?: string;
}) {
  const { scheme, locale } = useSettings();
  const color =
    type != null
      ? `amount-num font-medium ${amountClassForType(type, scheme)}`
      : 'amount-num font-medium text-ink';

  const text =
    showSign && type != null
      ? formatTypedMoney(cents, type, locale)
      : formatPlainMoney(cents, locale);

  return (
    <span className={`inline-block ${color} ${className}`}>{text}</span>
  );
}
