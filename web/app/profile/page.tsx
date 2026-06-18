'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/components/AuthProvider';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';

function ProfileContent() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const links = [
    { href: '/profile/contacts/', label: t('profile.contacts') },
    { href: '/profile/tags/', label: t('profile.tags') },
    { href: '/profile/data/', label: t('profile.data') },
    { href: '/profile/backup/', label: t('profile.backup') },
    { href: '/profile/settings/', label: t('profile.settings') },
  ];

  return (
    <div>
      {user?.username && (
        <div className="flex items-center gap-3 mb-4 min-w-0">
          <div
            className="w-10 h-10 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-sm font-medium text-accent uppercase"
            aria-hidden
          >
            {user.username.slice(0, 1)}
          </div>
          <span className="text-base font-medium text-ink truncate">{user.username}</span>
        </div>
      )}
      <Notebook>
        {links.map((l) => (
          <NotebookRow key={l.href} href={l.href}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink">{l.label}</span>
              <span className="text-muted">→</span>
            </div>
          </NotebookRow>
        ))}
        <NotebookRow onClick={logout} className="lg:hidden">
          <div className="flex items-center justify-between text-sm">
            <span className="text-expense">{t('profile.logout')}</span>
            <span className="text-muted">→</span>
          </div>
        </NotebookRow>
      </Notebook>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
