'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
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
      <BalanceGate />
    </RequireAuth>
  );
}

function BalanceGate() {
  const { canWrite } = useLedgerAccess();
  const router = useRouter();
  useEffect(() => {
    if (!canWrite) router.replace('/');
  }, [canWrite, router]);
  if (!canWrite) return null;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BalanceContent />
    </Suspense>
  );
}
