'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingFallback } from '@/components/ui/LoadingFallback';

function RedirectInner() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id');

  useEffect(() => {
    if (id) router.replace(`/add/?id=${id}`);
    else router.replace('/transactions/');
  }, [id, router]);

  return <p className="text-muted text-sm">跳转中…</p>;
}

export default function TransactionDetailRedirect() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RedirectInner />
    </Suspense>
  );
}
