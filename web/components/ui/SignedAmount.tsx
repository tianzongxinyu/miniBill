'use client';

import { useSettings } from '@/components/SettingsProvider';
import { amountClassForSign } from '@/lib/amountColors';
import { formatSignedMoney } from '@/lib/formatMoney';

export function SignedAmount({
  cents,
  className = '',
}: {
  cents: number;
  className?: string;
}) {
  const { scheme } = useSettings();
  const color = amountClassForSign(cents, scheme);

  return (
    <span className={`inline-block amount-num font-medium ${color} ${className}`}>
      {formatSignedMoney(cents)}
    </span>
  );
}
