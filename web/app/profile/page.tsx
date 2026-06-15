'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';

function ProfileContent() {
  const { user, logout } = useAuth();
  const links = [
    { href: '/profile/contacts/', label: '联系人' },
    { href: '/profile/tags/', label: '标签管理' },
    { href: '/profile/data/', label: '数据管理' },
    { href: '/profile/settings/', label: '设置' },
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
            <span className="text-expense">退出登录</span>
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
