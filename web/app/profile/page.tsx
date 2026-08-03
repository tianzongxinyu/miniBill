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

function ProfileContent() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { active, ledgers, isOwner, switchLedger } = useLedgerAccess();
  const [pickerOpen, setPickerOpen] = useState(false);

  const links = useMemo(() => {
    const rows: Array<{ href: string; label: string }> = [
      { href: '/profile/contacts/', label: t('profile.contacts') },
      { href: '/profile/tags/', label: t('profile.tags') },
    ];
    if (!isOwner) return rows;
    rows.push({ href: '/profile/data/', label: t('profile.data') });
    rows.push({ href: '/profile/backup/', label: t('profile.backup') });
    rows.push({ href: '/profile/settings/', label: t('profile.settings') });
    rows.push({ href: '/profile/grants/', label: t('profile.grants') });
    if (user?.is_admin) {
      rows.push({ href: '/profile/users/', label: t('profile.users') });
    }
    return rows;
  }, [isOwner, t, user?.is_admin]);

  const rightLabel = isOwner
    ? t('profile.switchLedger')
    : active?.username ?? t('profile.switchLedger');

  const rightPermission =
    !isOwner && active
      ? active.permission === 'edit'
        ? t('profile.permissionEdit')
        : t('profile.permissionRead')
      : null;

  return (
    <div>
      {user?.username && (
        <div className="flex items-center gap-3 mb-2 min-w-0">
          <div
            className="w-10 h-10 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-sm font-medium text-accent uppercase"
            aria-hidden
          >
            {user.username.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-medium text-ink truncate">{user.username}</div>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="shrink-0 text-right max-w-[40%]"
          >
            <div className="text-sm text-accent font-medium truncate">{rightLabel}</div>
            {rightPermission && (
              <div className="text-xs text-muted truncate">{rightPermission}</div>
            )}
          </button>
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
