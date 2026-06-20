'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { Notebook } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useManagedEntityList } from '@/hooks/useManagedEntityList';
import {
  createContact,
  deleteContact,
  fetchUsedTransactionContacts,
  type Contact,
} from '@/lib/api';

function ContactsContent() {
  const { t } = useTranslation();
  const {
    items,
    usedIds,
    name,
    setName,
    error,
    deleteTarget,
    setDeleteTarget,
    deleting,
    create,
    confirmRemove,
  } = useManagedEntityList<Contact>({
    listPath: '/contacts',
    fetchUsed: fetchUsedTransactionContacts,
    createItem: createContact,
    deleteItem: deleteContact,
    createErrorFallback: t('contacts.failed'),
  });

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
