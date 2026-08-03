'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { AdminListRow, ProfilePageHeader } from '@/components/profile/ProfileListChrome';
import { PageBackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditIcon } from '@/components/ui/EditIcon';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { EyeIcon, EyeOffIcon } from '@/components/ui/VisibilityIcon';
import { usePortalPresence } from '@/hooks/usePortalPresence';
import {
  adminCreateUser,
  adminDeleteUser,
  adminResetPassword,
  adminUpdateUser,
  fetchAdminUsers,
  type AdminUser,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function RoleSegment({
  isAdmin,
  disabled,
  onChange,
}: {
  isAdmin: boolean;
  disabled?: boolean;
  onChange: (isAdmin: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="form-hero-type !mb-0">
      <button
        type="button"
        className={!isAdmin ? 'btn-segment-active' : 'btn-segment'}
        onClick={() => onChange(false)}
        disabled={disabled}
      >
        {t('admin.roleUser')}
      </button>
      <button
        type="button"
        className={isAdmin ? 'btn-segment-active' : 'btn-segment'}
        onClick={() => onChange(true)}
        disabled={disabled}
      >
        {t('admin.roleAdmin')}
      </button>
    </div>
  );
}

function CreateUserDialog({
  open,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (username: string, password: string, isAdmin: boolean) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { hydrated, present, leaving, onLeaveEnd } = usePortalPresence(open);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setLocalError('');
      setIsAdmin(false);
    }
  }, [open]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !leaving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [present, saving, leaving, onClose]);

  if (!hydrated || !present) return null;

  const canSubmit =
    username.trim() !== '' &&
    password !== '' &&
    confirmPassword !== '' &&
    !saving &&
    !leaving;

  const handleSubmit = () => {
    if (password !== confirmPassword) {
      setLocalError(t('auth.passwordMismatch'));
      return;
    }
    setLocalError('');
    void onSubmit(username.trim(), password, isAdmin);
  };

  const displayError = localError || error;

  return createPortal(
    <div
      className={`confirm-overlay${leaving ? ' confirm-leave' : ''}`}
      role="presentation"
      onAnimationEnd={onLeaveEnd}
      onClick={() => {
        if (!saving && !leaving) onClose();
      }}
    >
      <div
        className="confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-user-dialog-title" className="confirm-title">
          {t('admin.addUser')}
        </h2>
        {displayError ? <p className="confirm-message text-expense text-sm mt-2">{displayError}</p> : null}
        <div className="mt-3 space-y-3">
          <input
            className="field w-full"
            placeholder={t('auth.username')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={saving}
            autoComplete="off"
          />
          <input
            className="field w-full"
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLocalError('');
            }}
            disabled={saving}
            autoComplete="new-password"
          />
          <input
            className="field w-full"
            type="password"
            placeholder={t('auth.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setLocalError('');
            }}
            disabled={saving}
            autoComplete="new-password"
          />
          <RoleSegment isAdmin={isAdmin} disabled={saving} onChange={setIsAdmin} />
        </div>
        <div className="confirm-actions mt-4">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onClose}
            disabled={saving || leaving}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-confirm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {saving ? t('common.processing') : t('admin.create')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditUserDialog({
  open,
  target,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: AdminUser | null;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (patch: { isAdmin: boolean; password: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { hydrated, present, leaving, onLeaveEnd } = usePortalPresence(open);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (open && target) {
      setIsAdmin(target.is_admin);
      setPassword('');
      setConfirmPassword('');
      setLocalError('');
    }
  }, [open, target]);

  useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !leaving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [present, saving, leaving, onClose]);

  if (!hydrated || !present || !target) return null;

  const dirty = isAdmin !== target.is_admin || password !== '';
  const canSubmit =
    dirty &&
    (password === '' || confirmPassword !== '') &&
    !saving &&
    !leaving;

  const handleSubmit = () => {
    if (password !== '' && password !== confirmPassword) {
      setLocalError(t('auth.passwordMismatch'));
      return;
    }
    setLocalError('');
    void onSubmit({ isAdmin, password });
  };

  const displayError = localError || error;

  return createPortal(
    <div
      className={`confirm-overlay${leaving ? ' confirm-leave' : ''}`}
      role="presentation"
      onAnimationEnd={onLeaveEnd}
      onClick={() => {
        if (!saving && !leaving) onClose();
      }}
    >
      <div
        className="confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-user-dialog-title" className="confirm-title">
          {t('admin.editTitle', { name: target.username })}
        </h2>
        {displayError ? <p className="confirm-message text-expense text-sm mt-2">{displayError}</p> : null}
        <div className="mt-3 space-y-3">
          <RoleSegment isAdmin={isAdmin} disabled={saving} onChange={setIsAdmin} />
          <input
            className="field w-full"
            type="password"
            placeholder={t('admin.newPasswordOptional')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLocalError('');
            }}
            disabled={saving}
            autoComplete="new-password"
          />
          <input
            className="field w-full"
            type="password"
            placeholder={t('auth.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setLocalError('');
            }}
            disabled={saving}
            autoComplete="new-password"
          />
        </div>
        <div className="confirm-actions mt-4">
          <button
            type="button"
            className="confirm-cancel"
            onClick={onClose}
            disabled={saving || leaving}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-confirm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {saving ? t('common.processing') : t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function UsersContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { isOwner, ready: ledgerReady } = useLedgerAccess();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setItems(await fetchAdminUsers());
  }, []);

  useEffect(() => {
    if (!user || !ledgerReady) return;
    if (!isOwner || !user.is_admin) {
      router.replace('/profile/');
      return;
    }
    void load().catch((err) => setError(formatApiError(err, t('common.loadFailed'))));
  }, [isOwner, ledgerReady, load, router, t, user]);

  if (!user?.is_admin || !isOwner) {
    return null;
  }

  const onCreate = async (username: string, password: string, isAdmin: boolean) => {
    setSaving(true);
    setCreateError('');
    try {
      const created = await adminCreateUser(username, password);
      if (isAdmin) {
        await adminUpdateUser(created.id, { is_admin: true });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setCreateError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const onEditSave = async (patch: { isAdmin: boolean; password: string }) => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    try {
      if (patch.isAdmin !== editTarget.is_admin) {
        await adminUpdateUser(editTarget.id, { is_admin: patch.isAdmin });
      }
      if (patch.password) {
        await adminResetPassword(editTarget.id, patch.password);
      }
      setEditTarget(null);
      await load();
    } catch (err) {
      setEditError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setEditSaving(false);
    }
  };

  const toggleDisabled = async (u: AdminUser) => {
    setBusyId(u.id);
    setError('');
    try {
      await adminUpdateUser(u.id, { disabled: !u.disabled });
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await adminDeleteUser(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-detail-with-floating-back space-y-3">
      <ProfilePageHeader
        title={t('profile.users')}
        description={t('admin.description')}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreateError('');
              setDialogOpen(true);
            }}
          >
            {t('admin.addUser')}
          </button>
        }
      />
      {error && <p className="text-expense text-sm">{error}</p>}

      {items.length === 0 ? (
        <EmptyNotebook message={t('admin.empty')} />
      ) : (
        <Notebook>
          {items.map((u) => {
            const isSelf = u.id === user.id;
            const roleLabel = u.is_admin ? t('admin.roleAdmin') : t('admin.roleUser');
            const statusMeta = [
              u.disabled ? t('admin.disabled') : null,
              isSelf ? t('admin.self') : null,
            ].filter(Boolean);
            return (
              <NotebookRow key={u.id}>
                <AdminListRow
                  left={
                    <>
                      <span className="text-ink font-medium">{u.username}</span>
                      {statusMeta.length > 0 && (
                        <span className="text-muted"> · {statusMeta.join(' · ')}</span>
                      )}
                    </>
                  }
                  center={roleLabel}
                  right={
                    !isSelf ? (
                      <>
                        <button
                          type="button"
                          className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                          onClick={() => {
                            setEditError('');
                            setEditTarget(u);
                          }}
                          aria-label={t('admin.editAria', { name: u.username })}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                          disabled={busyId === u.id}
                          onClick={() => void toggleDisabled(u)}
                          aria-label={
                            u.disabled
                              ? t('admin.enableAria', { name: u.username })
                              : t('admin.disableAria', { name: u.username })
                          }
                        >
                          {u.disabled ? <EyeIcon /> : <EyeOffIcon />}
                        </button>
                        {u.disabled && (
                          <button
                            type="button"
                            className="btn-ghost p-1.5 text-expense shrink-0"
                            onClick={() => setDeleteTarget(u)}
                            aria-label={t('admin.deleteAria', { name: u.username })}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </>
                    ) : undefined
                  }
                />
              </NotebookRow>
            );
          })}
        </Notebook>
      )}

      <CreateUserDialog
        open={dialogOpen}
        saving={saving}
        error={createError}
        onClose={() => {
          if (!saving) {
            setDialogOpen(false);
            setCreateError('');
          }
        }}
        onSubmit={onCreate}
      />

      <EditUserDialog
        open={!!editTarget}
        target={editTarget}
        saving={editSaving}
        error={editError}
        onClose={() => {
          if (!editSaving) {
            setEditTarget(null);
            setEditError('');
          }
        }}
        onSubmit={onEditSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('admin.deleteTitle')}
        message={t('admin.deleteMessage', { name: deleteTarget?.username ?? '' })}
        confirmLabel={t('admin.delete')}
        confirming={deleting}
        onConfirm={() => void onDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <PageBackLink href="/profile/" floating />
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireAuth>
      <UsersContent />
    </RequireAuth>
  );
}
