'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
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
      setError(formatApiError(e, '加载失败'));
    }
  }, []);

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
      setError(formatApiError(err, '失败'));
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
      setError(formatApiError(err, '删除失败'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <BackLink href="/profile/">我的</BackLink>
      {error && <p className="text-expense text-sm mb-4">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input
          className="field flex-1"
          placeholder="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="btn-primary shrink-0">添加</button>
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
                aria-label={`删除联系人「${c.name}」`}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
      </Notebook>
      <ConfirmDialog
        open={deleteTarget != null}
        title="删除联系人"
        message={deleteTarget ? `确定删除联系人「${deleteTarget.name}」？` : ''}
        confirmLabel="删除"
        confirming={deleting}
        onConfirm={() => void confirmRemove()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
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
