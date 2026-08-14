'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';
import { usePortalPresence } from '@/hooks/usePortalPresence';
import type { LedgerAccessItem } from '@/lib/api';

type ProfileLink = {
  href: string;
  label: string;
  icon: 'contacts' | 'tags' | 'recurring' | 'data' | 'backup' | 'settings' | 'grants' | 'users';
};

function ledgerLabel(
  item: LedgerAccessItem,
  t: (key: string, opts?: Record<string, string>) => string
) {
  if (item.permission === 'owner') {
    return t('profile.myLedger');
  }
  const permission =
    item.permission === 'edit' ? t('profile.permissionEdit') : t('profile.permissionRead');
  return t('profile.otherLedger', { name: item.username, permission });
}

function LedgerSwitchDialog({
  open,
  ledgers,
  activeOwnerId,
  onSelect,
  onClose,
}: {
  open: boolean;
  ledgers: LedgerAccessItem[];
  activeOwnerId: number | null | undefined;
  onSelect: (ownerId: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { hydrated, present, leaving, onLeaveEnd } = usePortalPresence(open);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !leaving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [present, leaving, onClose]);

  if (!hydrated || !present) return null;

  return createPortal(
    <div
      className={`confirm-overlay${leaving ? ' confirm-leave' : ''}`}
      role="presentation"
      onAnimationEnd={onLeaveEnd}
      onClick={() => {
        if (!leaving) onClose();
      }}
    >
      <div
        className="confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-switch-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ledger-switch-title" className="confirm-title">
          {t('profile.switchLedger')}
        </h2>
        <ul className="mt-3 space-y-1 max-h-[min(50vh,320px)] overflow-y-auto">
          {ledgers.map((item) => {
            const selected = activeOwnerId === item.owner_id;
            return (
              <li key={item.owner_id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm flex items-center justify-between gap-2 ${
                    selected ? 'bg-accent-soft text-accent font-medium' : 'text-ink hover:bg-canvas'
                  }`}
                  onClick={() => {
                    onSelect(item.owner_id);
                    onClose();
                  }}
                >
                  <span className="truncate">{ledgerLabel(item, t)}</span>
                  {selected && <span className="shrink-0">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="confirm-actions mt-4">
          <button type="button" className="confirm-cancel" onClick={onClose} disabled={leaving}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SwitchLedgerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="shrink-0 text-accent"
      aria-hidden
    >
      <path d="M8 7h12M17 4l3 3-3 3M16 17H4M7 20l-3-3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="shrink-0 text-muted/70"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ name }: { name: ProfileLink['icon'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    className: 'shrink-0 text-muted',
    'aria-hidden': true as const,
  };
  switch (name) {
    case 'contacts':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.6a3.5 3.5 0 0 1 0 6.8" strokeLinecap="round" />
        </svg>
      );
    case 'tags':
      return (
        <svg {...common}>
          <path
            d="M20.5 13.5 12 22l-8.5-8.5V4h9.5L20.5 13.5Z"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'recurring':
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0 1 13.5-5.7M20 5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 12a8 8 0 0 1-13.5 5.7M4 19v-5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'data':
      return (
        <svg {...common}>
          <path d="M4 6.5C4 5 7.5 4 12 4s8 1 8 2.5S16.5 9 12 9 4 8 4 6.5Z" />
          <path d="M4 6.5V12c0 1.5 3.5 2.5 8 2.5s8-1 8-2.5V6.5" strokeLinecap="round" />
          <path d="M4 12v5.5C4 19 7.5 20 12 20s8-1 8-2.5V12" strokeLinecap="round" />
        </svg>
      );
    case 'backup':
      return (
        <svg {...common}>
          <path d="M4 14.5V17a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2.5" strokeLinecap="round" />
          <path d="M12 4v11M8.5 11.5 12 15l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 3.5v2M12 18.5v2M4.9 6.5l1.4 1.4M17.7 16.1l1.4 1.4M3.5 12h2M18.5 12h2M4.9 17.5l1.4-1.4M17.7 7.9l1.4-1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'grants':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9.5" cy="7.5" r="3.25" />
          <path d="M19 8v4M17 10h4" strokeLinecap="round" />
        </svg>
      );
  }
}

function ProfileContent() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { active, ledgers, isOwner, switchLedger } = useLedgerAccess();
  const [pickerOpen, setPickerOpen] = useState(false);

  const links = useMemo(() => {
    const rows: ProfileLink[] = [
      { href: '/profile/contacts/', label: t('profile.contacts'), icon: 'contacts' },
      { href: '/profile/tags/', label: t('profile.tags'), icon: 'tags' },
      { href: '/profile/recurring/', label: t('profile.recurring'), icon: 'recurring' },
    ];
    if (!isOwner) return rows;
    rows.push({ href: '/profile/data/', label: t('profile.data'), icon: 'data' });
    rows.push({ href: '/profile/backup/', label: t('profile.backup'), icon: 'backup' });
    rows.push({ href: '/profile/settings/', label: t('profile.settings'), icon: 'settings' });
    rows.push({ href: '/profile/grants/', label: t('profile.grants'), icon: 'grants' });
    if (user?.is_admin) {
      rows.push({ href: '/profile/users/', label: t('profile.users'), icon: 'users' });
    }
    return rows;
  }, [isOwner, t, user?.is_admin]);

  const rightLabel = isOwner
    ? t('profile.myLedger')
    : active?.username ?? t('profile.myLedger');

  const rightPermission =
    !isOwner && active
      ? active.permission === 'edit'
        ? t('profile.permissionEdit')
        : t('profile.permissionRead')
      : null;

  const ledgerHint = isOwner
    ? t('profile.myLedger')
    : rightPermission ?? t('profile.myLedger');

  return (
    <div>
      {user?.username && (
        <div
          className="mb-4 flex items-center gap-3 min-w-0 rounded-2xl border border-line/80 bg-surface p-4 shadow-panel"
          style={{ animation: 'scale-in 0.4s var(--ease-out-expo) both' }}
        >
          <div
            className="w-12 h-12 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-base font-semibold text-accent uppercase"
            aria-hidden
          >
            {user.username.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-ink truncate">{user.username}</div>
            <div className="text-xs text-muted truncate mt-0.5">{ledgerHint}</div>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label={t('profile.switchLedger')}
            className="shrink-0 flex items-center gap-1.5 max-w-[42%] rounded-2xl border bg-accent-soft/70 px-2.5 py-1.5"
            style={{ borderColor: 'var(--control-border)' }}
          >
            <div className="min-w-0 text-right">
              <div className="text-sm text-accent font-medium truncate">{rightLabel}</div>
              {rightPermission && (
                <div className="text-[11px] text-muted truncate leading-tight">{rightPermission}</div>
              )}
            </div>
            <SwitchLedgerIcon />
          </button>
        </div>
      )}

      <Notebook>
        {links.map((l) => (
          <NotebookRow key={l.href} href={l.href}>
            <div className="flex items-center gap-3 text-sm">
              <MenuIcon name={l.icon} />
              <span className="flex-1 min-w-0 font-medium text-ink truncate">{l.label}</span>
              <ChevronIcon />
            </div>
          </NotebookRow>
        ))}
      </Notebook>

      <Notebook className="mt-3 lg:hidden">
        <NotebookRow onClick={logout}>
          <div className="flex items-center justify-center text-sm">
            <span className="font-medium text-expense">{t('profile.logout')}</span>
          </div>
        </NotebookRow>
      </Notebook>

      <LedgerSwitchDialog
        open={pickerOpen}
        ledgers={ledgers}
        activeOwnerId={active?.owner_id}
        onSelect={switchLedger}
        onClose={() => setPickerOpen(false)}
      />
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
