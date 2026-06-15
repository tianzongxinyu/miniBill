'use client';

import { SignedAmount } from '@/components/ui/SignedAmount';

export function DailyExpenseAmount({
  cents,
  className = '',
}: {
  cents: number;
  className?: string;
}) {
  return <SignedAmount cents={-cents} className={className} />;
}
