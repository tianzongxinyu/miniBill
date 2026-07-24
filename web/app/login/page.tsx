'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import { AuthPageShell } from '@/components/ui/AuthPageShell';
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
    <AuthPageShell
      asideTitle={t('app.name')}
      asideSubtitle={t('auth.heroTagline')}
      asideFooter={t('auth.heroBadges')}
      showMobileLogo
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="lg:hidden text-center mb-2">
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
        <p className="text-xs text-muted -mt-2">{t('auth.forgotPasswordHint')}</p>
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
    </AuthPageShell>
  );
}
