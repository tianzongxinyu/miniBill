'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LoadingFallback } from '@/components/ui/LoadingFallback';

function RedirectInner() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');

  useEffect(() => {
    if (id) router.replace(`/add/?id=${id}`);
    else router.replace('/transactions/');
  }, [id, router]);

  return <p className="text-muted text-sm">{t('common.redirecting')}</p>;
}

export default function TransactionDetailRedirect() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RedirectInner />
    </Suspense>
  );
}
