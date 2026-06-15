'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { BalanceRegisterForm } from '@/components/balance/BalanceRegisterForm';
import {
  resolveDefaultBalanceMonth,
} from '@/lib/balanceMonth';
import { parseYearMonthQuery } from '@/lib/url';
import { fetchEarliestMonth, getCurrentYearMonth, type YearMonth } from '@/lib/api';

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
  const [minMonth, setMinMonth] = useState<YearMonth | null>(null);
  const [pageTitle, setPageTitle] = useState('余额登记');

  useEffect(() => {
    fetchEarliestMonth().then(setMinMonth).catch(() => setMinMonth(null));
  }, []);

  const handleInitialLoaded = useCallback(({ isEdit }: { isEdit: boolean }) => {
    setPageTitle(isEdit ? '编辑余额' : '余额登记');
  }, []);

  const backHref = returnTo.startsWith('/') ? returnTo : '/';

  return (
    <div>
      <BackLink href={backHref}>返回</BackLink>
      <PageHeader title={pageTitle} />
      <BalanceRegisterForm
        key={`${initialTarget.year}-${initialTarget.month}`}
        initialTarget={initialTarget}
        minMonth={minMonth}
        maxMonth={maxMonth}
        returnTo={backHref}
        onInitialLoaded={handleInitialLoaded}
      />
    </div>
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
