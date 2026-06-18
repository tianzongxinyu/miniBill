'use client';

import { useSettings } from '@/components/SettingsProvider';
import { formatBalanceMoney } from '@/lib/formatMoney';

/** 登记/年末余额：正数带 +，中性色，不参与涨跌配色 */
export function BalanceAmount({
  cents,
  className = '',
}: {
  cents: number;
  className?: string;
}) {
  const { locale } = useSettings();

  return (
    <span className={`inline-block amount-num font-medium text-ink ${className}`}>
      {formatBalanceMoney(cents, locale)}
    </span>
  );
}
