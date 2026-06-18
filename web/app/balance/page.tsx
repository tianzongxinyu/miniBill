'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { BalanceRegisterForm } from '@/components/balance/BalanceRegisterForm';
import {
  resolveDefaultBalanceMonth,
} from '@/lib/balanceMonth';
import { parseYearMonthQuery } from '@/lib/url';
import { fetchEarliestMonth, getCurrentYearMonth, type YearMonth } from '@/lib/api';

function BalanceContent() {
  const { t } = useTranslation();
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
  const [pageTitle, setPageTitle] = useState(t('balance.registerTitle'));

  useEffect(() => {
    fetchEarliestMonth().then(setMinMonth).catch(() => setMinMonth(null));
  }, []);

  const handleInitialLoaded = useCallback(({ isEdit }: { isEdit: boolean }) => {
    setPageTitle(isEdit ? t('balance.editTitle') : t('balance.registerTitle'));
  }, [t]);

  const backHref = returnTo.startsWith('/') ? returnTo : '/';

  return (
    <BalanceRegisterForm
      key={`${initialTarget.year}-${initialTarget.month}`}
      backHref={backHref}
      pageTitle={pageTitle}
      initialTarget={initialTarget}
      minMonth={minMonth}
      maxMonth={maxMonth}
      returnTo={backHref}
      onInitialLoaded={handleInitialLoaded}
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
