'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { BalanceRegisterForm } from '@/components/balance/BalanceRegisterForm';
import {
  maxRegisterableBalanceMonth,
  resolveDefaultBalanceMonth,
} from '@/lib/balanceMonth';
import { parseYearMonthQuery } from '@/lib/url';
import { compareYearMonth, fetchMonthlyBalance, getCurrentYearMonth } from '@/lib/api';
import { useEarliestMonth } from '@/hooks/useEarliestMonth';

function BalanceContent() {
  const params = useSearchParams();
  const yearRaw = params.get('year');
  const monthRaw = params.get('month');
  const returnTo = params.get('returnTo') || '/';

  const registerMax = maxRegisterableBalanceMonth();
  const currentMonth = useMemo(() => getCurrentYearMonth(), []);
  const [currentHasBalance, setCurrentHasBalance] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const record = await fetchMonthlyBalance(currentMonth.year, currentMonth.month);
        if (!cancelled) setCurrentHasBalance(record != null);
      } catch {
        if (!cancelled) setCurrentHasBalance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentMonth.year, currentMonth.month]);

  const maxMonth = useMemo(() => {
    if (currentHasBalance && compareYearMonth(currentMonth, registerMax) > 0) {
      return currentMonth;
    }
    return registerMax;
  }, [currentHasBalance, currentMonth, registerMax]);

  const initialTarget = useMemo(() => {
    if (currentHasBalance === null) return null;
    const fromQuery = parseYearMonthQuery(yearRaw, monthRaw);
    const target = fromQuery ?? resolveDefaultBalanceMonth();
    // Allow deep-link to current month when it already has a balance.
    if (
      fromQuery &&
      currentHasBalance &&
      sameYearMonth(fromQuery, currentMonth)
    ) {
      return fromQuery;
    }
    return compareYearMonth(target, maxMonth) > 0 ? maxMonth : target;
  }, [yearRaw, monthRaw, maxMonth, currentHasBalance, currentMonth]);

  const minMonth = useEarliestMonth();
  const backHref = returnTo.startsWith('/') ? returnTo : '/';

  if (currentHasBalance === null || initialTarget == null) {
    return <LoadingFallback />;
  }

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

function sameYearMonth(
  a: { year: number; month: number },
  b: { year: number; month: number }
) {
  return a.year === b.year && a.month === b.month;
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
