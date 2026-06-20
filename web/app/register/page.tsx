'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import { AuthPageShell } from '@/components/ui/AuthPageShell';
import { formatApiError } from '@/lib/errors';
import { redirectToHome } from '@/lib/api';

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
    <AuthPageShell
      asideTitle={t('auth.getStarted')}
      asideSubtitle={t('auth.registerSubtitle')}
      asideFooter={t('auth.registerHints')}
    >
      <form onSubmit={submit} className="space-y-5">
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
    </AuthPageShell>
  );
}
