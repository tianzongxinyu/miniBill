'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { redirectToLogin } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { AppLogo } from '@/components/ui/AppLogo';

function AuthSplash({
  hint,
  action,
}: {
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas gap-4 px-6">
      <AppLogo size="md" className="animate-scale-in" priority />
      {hint ? <p className="text-sm text-muted text-center">{hint}</p> : <div className="h-1 w-24 loading-shimmer" />}
      {action}
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [showLoginLink, setShowLoginLink] = useState(false);

  useLayoutEffect(() => {
    if (!ready || user) return;
    router.replace('/login/');
    redirectToLogin();
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || user) {
      setShowLoginLink(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLoginLink(true), 1500);
    return () => window.clearTimeout(timer);
  }, [ready, user]);

  if (!ready) {
    return <AuthSplash />;
  }

  if (!user) {
    return (
      <AuthSplash
        hint={showLoginLink ? '若长时间未跳转，请手动进入登录页' : '正在跳转到登录…'}
        action={
          showLoginLink ? (
            <Link href="/login/" className="btn-primary px-6 py-2.5 text-sm">
              前往登录
            </Link>
          ) : undefined
        }
      />
    );
  }

  return <AppShell>{children}</AppShell>;
}
