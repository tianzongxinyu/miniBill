'use client';

import { useLayoutEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { redirectToLogin } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { AppLogo } from '@/components/ui/AppLogo';

function AuthSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <AppLogo size="md" className="animate-scale-in" priority />
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();

  useLayoutEffect(() => {
    if (!ready || user) return;
    redirectToLogin();
  }, [ready, user]);

  if (!ready || !user) {
    return <AuthSplash />;
  }

  return <AppShell>{children}</AppShell>;
}
