'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { AdminListRow, ProfilePageHeader } from '@/components/profile/ProfileListChrome';
import { PageBackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditIcon } from '@/components/ui/EditIcon';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { Notebook, NotebookRow } from '@/components/ui/Notebook';
import { SimpleSelect } from '@/components/ui/SimpleSelect';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { usePortalPresence } from '@/hooks/usePortalPresence';
import {
  deleteLedgerGrant,
  fetchLedgerGrants,
  fetchUserDirectory,
  upsertLedgerGrant,
  type DirectoryUser,
  type LedgerGrantItem,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function GrantDialog({
  open,
  directory,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  directory: DirectoryUser[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (granteeId: number, permission: 'read' | 'edit') => Promise<void>;
}) {
  const { t } = useTranslation();
  const { hydrated, present, leaving, onLeaveEnd } = usePortalPresence(open);
  const [granteeId, setGranteeId] = useState<number | ''>('');
  const [permission, setPermission] = useState<'read' | 'edit'>('read');

  useEffect(() => {
    if (open) {
      setGranteeId('');
      setPermission('read');
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

  const canSubmit = granteeId !== '' && directory.length > 0 && !saving && !leaving;
  const userOptions = directory.map((u) => ({ value: String(u.id), label: u.username }));

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
        aria-labelledby="grant-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="grant-dialog-title" className="confirm-title">
          {t('grants.add')}
        </h2>
        {directory.length === 0 ? (
          <p className="confirm-message text-sm">{t('grants.noUsers')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <SimpleSelect
              value={granteeId === '' ? '' : String(granteeId)}
              options={userOptions}
              placeholder={t('grants.pickUser')}
              ariaLabel={t('grants.pickUser')}
              disabled={saving}
              className="w-full"
              onChange={(v) => setGranteeId(v ? Number(v) : '')}
            />
            <div className="form-hero-type !mb-0">
              <button
                type="button"
                className={permission === 'read' ? 'btn-segment-active' : 'btn-segment'}
                onClick={() => setPermission('read')}
                disabled={saving}
              >
                {t('profile.permissionRead')}
              </button>
              <button
                type="button"
                className={permission === 'edit' ? 'btn-segment-active' : 'btn-segment'}
                onClick={() => setPermission('edit')}
                disabled={saving}
              >
                {t('profile.permissionEdit')}
              </button>
            </div>
          </div>
        )}
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
            onClick={() => {
              if (granteeId === '') return;
              void onSubmit(granteeId, permission);
            }}
          >
            {saving ? t('common.processing') : t('grants.grant')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditGrantDialog({
  open,
  target,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: LedgerGrantItem | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (permission: 'read' | 'edit') => Promise<void>;
}) {
  const { t } = useTranslation();
  const { hydrated, present, leaving, onLeaveEnd } = usePortalPresence(open);
  const [permission, setPermission] = useState<'read' | 'edit'>('read');

  useEffect(() => {
    if (open && target) {
      setPermission(target.permission === 'edit' ? 'edit' : 'read');
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
        aria-labelledby="edit-grant-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-grant-dialog-title" className="confirm-title">
          {t('grants.editTitle', { name: target.grantee_username })}
        </h2>
        <div className="mt-3 space-y-3">
          <div className="form-hero-type !mb-0">
            <button
              type="button"
              className={permission === 'read' ? 'btn-segment-active' : 'btn-segment'}
              onClick={() => setPermission('read')}
              disabled={saving}
            >
              {t('profile.permissionRead')}
            </button>
            <button
              type="button"
              className={permission === 'edit' ? 'btn-segment-active' : 'btn-segment'}
              onClick={() => setPermission('edit')}
              disabled={saving}
            >
              {t('profile.permissionEdit')}
            </button>
          </div>
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
            disabled={saving || leaving}
            onClick={() => void onSubmit(permission)}
          >
            {saving ? t('common.processing') : t('common.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GrantsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOwner, ready: ledgerReady } = useLedgerAccess();
  const [grants, setGrants] = useState<LedgerGrantItem[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<LedgerGrantItem | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LedgerGrantItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [g, d] = await Promise.all([fetchLedgerGrants(), fetchUserDirectory()]);
    setGrants(g);
    setDirectory(d);
  }, []);

  useEffect(() => {
    if (!ledgerReady) return;
    if (!isOwner) {
      router.replace('/profile/');
      return;
    }
    void load().catch((err) => setError(formatApiError(err, t('common.loadFailed'))));
  }, [isOwner, ledgerReady, load, router, t]);

  const available = useMemo(
    () => directory.filter((u) => !grants.some((g) => g.grantee_user_id === u.id)),
    [directory, grants]
  );

  if (!isOwner) {
    return null;
  }

  const onGrant = async (granteeId: number, permission: 'read' | 'edit') => {
    setSaving(true);
    setError('');
    try {
      await upsertLedgerGrant(granteeId, permission);
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const onEditSave = async (permission: 'read' | 'edit') => {
    if (!editTarget) return;
    setEditSaving(true);
    setError('');
    try {
      await upsertLedgerGrant(editTarget.grantee_user_id, permission);
      setEditTarget(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
    } finally {
      setEditSaving(false);
    }
  };

  const onRevoke = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await deleteLedgerGrant(deleteTarget.grantee_user_id);
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
        title={t('profile.grants')}
        description={t('grants.description')}
        action={
          <button type="button" className="btn-primary" onClick={() => setDialogOpen(true)}>
            {t('grants.grant')}
          </button>
        }
      />
      {error && <p className="text-expense text-sm">{error}</p>}

      {grants.length === 0 ? (
        <EmptyNotebook message={t('grants.empty')} />
      ) : (
        <Notebook>
          {grants.map((g) => {
            const permLabel =
              g.permission === 'edit' ? t('profile.permissionEdit') : t('profile.permissionRead');
            return (
              <NotebookRow key={g.id}>
                <AdminListRow
                  left={<span className="text-ink font-medium">{g.grantee_username}</span>}
                  center={permLabel}
                  right={
                    <>
                      <button
                        type="button"
                        onClick={() => setEditTarget(g)}
                        className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                        aria-label={t('grants.editAria', { name: g.grantee_username })}
                      >
                        <EditIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(g)}
                        className="btn-ghost p-1.5 text-expense shrink-0"
                        aria-label={t('grants.deleteAria', { name: g.grantee_username })}
                      >
                        <TrashIcon />
                      </button>
                    </>
                  }
                />
              </NotebookRow>
            );
          })}
        </Notebook>
      )}

      <GrantDialog
        open={dialogOpen}
        directory={available}
        saving={saving}
        onClose={() => setDialogOpen(false)}
        onSubmit={onGrant}
      />

      <EditGrantDialog
        open={!!editTarget}
        target={editTarget}
        saving={editSaving}
        onClose={() => {
          if (!editSaving) setEditTarget(null);
        }}
        onSubmit={onEditSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('grants.deleteTitle')}
        message={t('grants.deleteConfirm', { name: deleteTarget?.grantee_username ?? '' })}
        confirmLabel={t('grants.revoke')}
        confirming={deleting}
        onConfirm={() => void onRevoke()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <PageBackLink href="/profile/" floating />
    </div>
  );
}

export default function GrantsPage() {
  return (
    <RequireAuth>
      <GrantsContent />
    </RequireAuth>
  );
}
