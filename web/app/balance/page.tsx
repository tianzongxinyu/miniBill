'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { BalanceRegisterForm } from '@/components/balance/BalanceRegisterForm';
import {
  resolveDefaultBalanceMonth,
} from '@/lib/balanceMonth';
import { parseYearMonthQuery } from '@/lib/url';
import { getCurrentYearMonth } from '@/lib/api';
import { useEarliestMonth } from '@/hooks/useEarliestMonth';

function BalanceContent() {
  const params = useSearchParams();
  const yearRaw = params.get('year');
  const monthRaw = params.get('month');
  const returnTo = params.get('returnTo') || '/';

  const initialTarget = useMemo(() => {
    const fromQuery = parseYearMonthQuery(yearRaw, monthRaw);
    return fromQuery ?? resolveDefaultBalanceMonth();
  }, [yearRaw, monthRaw]);

  const maxMonth = getCurrentYearMonth();
  const minMonth = useEarliestMonth();

  const backHref = returnTo.startsWith('/') ? returnTo : '/';

  return (
    <BalanceRegisterForm
      key={`${initialTarget.year}-${initialTarget.month}`}
      backHref={backHref}
      initialTarget={initialTarget}
      minMonth={minMonth}
      maxMonth={maxMonth}
      returnTo={backHref}
    />
  );
}

export default function BalancePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <BalanceContent />
      </Suspense>
    </RequireAuth>
  );
}
