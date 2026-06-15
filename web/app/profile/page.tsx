'use client';

import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader } from '@/components/ui/PageHeader';
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
      <PageHeader title="我的" subtitle={user?.username} />
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
