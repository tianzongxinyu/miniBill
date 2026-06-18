'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { Notebook } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  apiList,
  createContact,
  deleteContact,
  fetchUsedTransactionContacts,
  type Contact,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function ContactsContent() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Contact[]>([]);
  const [usedIds, setUsedIds] = useState<Set<number>>(() => new Set());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [contacts, used] = await Promise.all([
        apiList<Contact>('/contacts'),
        fetchUsedTransactionContacts(),
      ]);
      setItems(contacts);
      setUsedIds(new Set(used.map((c) => c.id)));
    } catch (e) {
      setItems([]);
      setUsedIds(new Set());
      setError(formatApiError(e, t('contacts.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createContact(name);
      setName('');
      void load();
    } catch (err) {
      setError(formatApiError(err, t('contacts.failed')));
    }
  };

  const confirmRemove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteContact(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } catch (err) {
      setError(formatApiError(err, t('contacts.deleteFailed')));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {error && <p className="text-expense text-sm mb-4">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-4">
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
        {items.map((c) => (
          <div key={c.id} className="notebook-row flex justify-between items-center gap-3">
            <Link href={`/profile/contacts/detail/?id=${c.id}`} className="min-w-0 flex-1">
              <div className="text-sm text-ink">{c.name}</div>
              {c.nickname && <div className="text-xs text-muted mt-1">{c.nickname}</div>}
            </Link>
            {!usedIds.has(c.id) && (
              <button
                type="button"
                onClick={() => setDeleteTarget(c)}
                className="btn-ghost p-1 text-expense shrink-0"
                aria-label={t('contacts.deleteAria', { name: c.name })}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
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
      <PageBackLink href="/profile/" />
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
