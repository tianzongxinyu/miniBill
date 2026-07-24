'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { EditIcon } from '@/components/ui/EditIcon';
import { Notebook } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EyeIcon, EyeOffIcon } from '@/components/ui/VisibilityIcon';
import { useManagedEntityList } from '@/hooks/useManagedEntityList';
import {
  createContact,
  deleteContact,
  fetchUsedTransactionContacts,
  updateContact,
  type Contact,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function ContactsContent() {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const skipBlurSave = useRef(false);
  const savingRef = useRef(false);
  const {
    items,
    usedIds,
    name,
    setName,
    error,
    setError,
    deleteTarget,
    setDeleteTarget,
    deleting,
    create,
    confirmRemove,
    load,
  } = useManagedEntityList<Contact>({
    listPath: '/contacts',
    fetchUsed: fetchUsedTransactionContacts,
    createItem: createContact,
    deleteItem: deleteContact,
    createErrorFallback: t('contacts.failed'),
  });

  const toggle = async (c: Contact) => {
    try {
      await updateContact(c.id, { enabled: !(c.enabled !== false) });
      void load();
    } catch (err) {
      setError(formatApiError(err, t('contacts.failed')));
    }
  };

  const startEdit = (c: Contact) => {
    skipBlurSave.current = false;
    setEditingId(c.id);
    setEditName(c.name);
    setError('');
  };

  const cancelEdit = () => {
    skipBlurSave.current = true;
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (c: Contact) => {
    if (savingRef.current) return;
    const next = editName.trim();
    if (!next || next === c.name) {
      cancelEdit();
      return;
    }
    const taken = items.some(
      (item) => item.id !== c.id && item.name.localeCompare(next, undefined, { sensitivity: 'accent' }) === 0
    );
    if (taken) {
      setError(t('contacts.nameTaken'));
      return;
    }
    savingRef.current = true;
    setRenaming(true);
    try {
      await updateContact(c.id, { name: next });
      setEditingId(null);
      setEditName('');
      void load();
    } catch (err) {
      setError(formatApiError(err, t('contacts.renameFailed')));
    } finally {
      savingRef.current = false;
      setRenaming(false);
    }
  };

  return (
    <div className="page-detail-with-floating-back">
      {error && <p className="text-expense text-sm mb-2">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-2">
        <input
          className="field flex-1"
          placeholder={t('contacts.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="btn-primary shrink-0">{t('contacts.add')}</button>
      </form>
      <Notebook>
        {items.map((c) => {
          const enabled = c.enabled !== false;
          const editing = editingId === c.id;
          return (
            <div key={c.id} className="notebook-row flex justify-between items-center gap-3">
              {editing ? (
                <input
                  className="field flex-1 min-w-0"
                  value={editName}
                  autoFocus
                  disabled={renaming}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void saveEdit(c);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onBlur={() => {
                    if (skipBlurSave.current) {
                      skipBlurSave.current = false;
                      return;
                    }
                    void saveEdit(c);
                  }}
                  aria-label={t('contacts.editName', { name: c.name })}
                />
              ) : (
                <Link
                  href={`/profile/contacts/detail/?id=${c.id}`}
                  className={`min-w-0 flex-1 ${enabled ? '' : 'opacity-45'}`}
                >
                  <div className="text-sm text-ink">{c.name}</div>
                  {c.nickname && <div className="text-xs text-muted mt-1">{c.nickname}</div>}
                </Link>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {!editing && (
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                    aria-label={t('contacts.editName', { name: c.name })}
                  >
                    <EditIcon />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void toggle(c)}
                  className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                  aria-label={
                    enabled
                      ? t('contacts.hideContact', { name: c.name })
                      : t('contacts.showContact', { name: c.name })
                  }
                >
                  {enabled ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                {!usedIds.has(c.id) && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(c)}
                    className="btn-ghost p-1.5 text-expense shrink-0"
                    aria-label={t('contacts.deleteAria', { name: c.name })}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Notebook>
      <ConfirmDialog
        open={deleteTarget != null}
        title={t('contacts.deleteTitle')}
        message={deleteTarget ? t('contacts.deleteMessage', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.delete')}
        confirming={deleting}
        onConfirm={() => void confirmRemove()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
      <PageBackLink href="/profile/" floating />
    </div>
  );
}

export default function ContactsPage() {
  return (
    <RequireAuth>
      <ContactsContent />
    </RequireAuth>
  );
}
