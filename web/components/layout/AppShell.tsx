'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { PageTransition } from '@/components/layout/PageTransition';
import { AppLogo } from '@/components/ui/AppLogo';
import { APP_NAME } from '@/lib/appMeta';

const SIDEBAR_KEY = 'sidebar-collapsed';
const EXPANDED_W = 'lg:ml-64';
const COLLAPSED_W = 'lg:ml-[4.5rem]';

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SIDEBAR_KEY) === '1';
}

const tabs = [
  { href: '/', label: '首页', icon: HomeIcon },
  { href: '/transactions/', label: '流水', icon: ListIcon },
  { href: '/stats/', label: '统计', icon: ChartIcon },
  { href: '/profile/', label: '我的', icon: UserIcon },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href.replace(/\/$/, ''));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);

  const toggleSidebar = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  const sidebarW = collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64';
  const mainMl = collapsed ? COLLAPSED_W : EXPANDED_W;

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? '4.5rem' : '16rem'
    );
  }, [collapsed]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        data-collapsed={collapsed || undefined}
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border shadow-sidebar z-40 transition-[width] duration-300 ease-out ${sidebarW}`}
      >
        <div className={`py-6 ${collapsed ? 'px-3' : 'px-5'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <AppLogo size="sm" priority />
            {!collapsed && (
              <div className="min-w-0 animate-fade-in">
                <div className="text-base font-semibold tracking-tight text-ink">{APP_NAME}</div>
                <div className="text-[11px] text-muted mt-0.5">个人记账本</div>
              </div>
            )}
          </div>
        </div>

        <nav className={`flex-1 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {tabs.map((t) => {
            const active = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                title={collapsed ? t.label : undefined}
                className={`${active ? 'nav-item-active' : 'nav-item'} ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon active={active} />
                {!collapsed && <span className="truncate">{t.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`mb-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          {!collapsed ? (
            <div className="p-4 rounded-2xl bg-sidebar-surface border border-sidebar-border animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-xs font-medium text-accent uppercase">
                  {user?.username?.slice(0, 1) ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{user?.username}</div>
                  <button
                    onClick={logout}
                    className="text-xs text-muted hover:text-accent transition-colors duration-200 mt-0.5"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              title={`${user?.username} · 退出`}
              className="w-full flex justify-center py-2 rounded-2xl hover:bg-accent-soft/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center text-xs font-medium text-accent uppercase">
                {user?.username?.slice(0, 1) ?? '?'}
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? '展开侧栏' : '折叠侧栏'}
            className={`mt-2 w-full flex items-center gap-2 py-2 rounded-2xl text-muted hover:text-accent hover:bg-accent-soft/50 transition-all duration-200 ${collapsed ? 'justify-center' : 'px-3'}`}
          >
            <CollapseIcon collapsed={collapsed} />
            {!collapsed && <span className="text-xs">收起侧栏</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 pb-24 lg:pb-8 min-h-screen transition-[margin] duration-300 ease-out ${mainMl}`}>
        <PageTransition>{children}</PageTransition>
      </main>

      <nav className="mobile-tab-nav lg:hidden fixed bottom-0 inset-x-0 bg-surface/95 backdrop-blur-md border-t border-line flex justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-50">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                active
                  ? 'text-accent font-medium bg-accent-soft'
                  : 'text-muted hover:text-accent/70'
              }`}
            >
              <Icon active={active} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

type IconProps = { active: boolean; dark?: boolean };

function iconClass(active: boolean) {
  return active ? 'text-accent' : 'text-muted';
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={`shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
    >
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={`shrink-0 transition-colors duration-200 ${iconClass(active)}`}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={`shrink-0 transition-colors duration-200 ${iconClass(active)}`}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={`shrink-0 transition-colors duration-200 ${iconClass(active)}`}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={`shrink-0 transition-colors duration-200 ${iconClass(active)}`}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.314 3.134-6 7-6s7 2.686 7 6" strokeLinecap="round" />
    </svg>
  );
}
