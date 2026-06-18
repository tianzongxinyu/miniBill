'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import { AuthPreferencesBar } from '@/components/ui/AuthPreferencesBar';
import { formatApiError } from '@/lib/errors';
import { AppLogo } from '@/components/ui/AppLogo';
import { redirectToHome } from '@/lib/api';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, ready, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (!ready || !user) return;
    redirectToHome();
  }, [ready, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      redirectToHome();
    } catch (err) {
      setError(formatApiError(err, t('auth.loginFailed')));
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas">
        <AppLogo size="md" priority />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-canvas gap-4 px-6">
        <AppLogo size="md" priority />
        <p className="text-sm text-muted">{t('auth.entering')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-accent to-accent-muted flex-col justify-between p-10 text-white">
        <div className="animate-fade-in-up">
          <AppLogo size="lg" className="mb-8" priority />
          <h1 className="text-3xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="text-white/80 mt-3 text-base leading-relaxed max-w-xs">
            {t('auth.heroTagline')}
          </p>
        </div>
        <p className="text-xs text-white/50 animate-fade-in" style={{ animationDelay: '200ms' }}>
          {t('auth.heroBadges')}
        </p>
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-6 bg-canvas">
          <form onSubmit={submit} className="w-full max-w-sm animate-scale-in space-y-5">
            <div className="lg:hidden text-center mb-6">
              <AppLogo size="md" className="mb-3 mx-auto" priority />
              <h1 className="text-2xl font-semibold text-ink">{t('app.name')}</h1>
            </div>
            <div className="hidden lg:block mb-2">
              <h2 className="text-xl font-semibold text-ink">{t('auth.welcomeBack')}</h2>
              <p className="text-sm text-muted mt-1">{t('auth.loginToContinue')}</p>
            </div>
            {error && <p className="text-expense text-sm animate-fade-in">{error}</p>}
            <input
              className="field"
              placeholder={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              className="field"
              placeholder={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" className="btn-primary-block">
              {t('auth.login')}
            </button>
            <p className="text-center text-sm text-muted">
              {t('auth.noAccount')}
              <Link href="/register/" className="text-ink underline underline-offset-4 hover:opacity-70 transition-opacity ml-1">
                {t('auth.register')}
              </Link>
            </p>
          </form>
        </div>
        <div className="shrink-0 px-6 pb-6 bg-canvas flex justify-center">
          <div className="w-full max-w-sm">
            <AuthPreferencesBar />
          </div>
        </div>
      </div>
    </div>
  );
}
