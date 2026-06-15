'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getToken } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { AppLogo } from '@/components/ui/AppLogo';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const token = getToken();
    if (!user || !token) router.replace('/login/');
  }, [user, loading, router]);

  if (loading || !user || !getToken()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas gap-4">
        <AppLogo size="md" className="animate-scale-in" priority />
        <div className="h-1 w-24 loading-shimmer" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
