'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import { AuthPreferencesBar } from '@/components/ui/AuthPreferencesBar';
import { formatApiError } from '@/lib/errors';
import { redirectToHome } from '@/lib/api';
import { AppLogo } from '@/components/ui/AppLogo';

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    try {
      await register(username, password);
      redirectToHome();
    } catch (err) {
      setError(formatApiError(err, t('auth.registerFailed')));
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-accent to-accent-muted flex-col justify-between p-10 text-white">
        <div className="animate-fade-in-up">
          <AppLogo size="lg" className="mb-8" priority />
          <h1 className="text-3xl font-semibold tracking-tight">{t('auth.getStarted')}</h1>
          <p className="text-white/80 mt-3 text-base leading-relaxed max-w-xs">
            {t('auth.registerSubtitle')}
          </p>
        </div>
        <p className="text-xs text-white/50">{t('auth.registerHints')}</p>
      </aside>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center p-6 bg-canvas">
          <form onSubmit={submit} className="w-full max-w-sm animate-scale-in space-y-5">
            <div className="hidden lg:block mb-2">
              <h2 className="text-xl font-semibold text-ink">{t('auth.registerAccount')}</h2>
              <p className="text-sm text-muted mt-1">{t('auth.fillInfo')}</p>
            </div>
            {error && <p className="text-expense text-sm animate-fade-in">{error}</p>}
            <input
              className="field"
              placeholder={t('auth.usernamePlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              className="field"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              type="password"
              className="field"
              placeholder={t('auth.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="submit" className="btn-primary-block">
              {t('auth.register')}
            </button>
            <p className="text-center text-sm text-muted">
              {t('auth.hasAccount')}
              <Link href="/login/" className="text-ink underline underline-offset-4 hover:opacity-70 transition-opacity ml-1">
                {t('auth.login')}
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
