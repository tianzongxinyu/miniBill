'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { Notebook } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EyeIcon, EyeOffIcon } from '@/components/ui/VisibilityIcon';
import {
  apiList,
  createTag,
  deleteTag,
  fetchUsedTransactionTags,
  updateTag,
  type Tag,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function TagsContent() {
  const [items, setItems] = useState<Tag[]>([]);
  const [usedIds, setUsedIds] = useState<Set<number>>(() => new Set());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [tags, used] = await Promise.all([
        apiList<Tag>('/tags'),
        fetchUsedTransactionTags(),
      ]);
      setItems(tags);
      setUsedIds(new Set(used.map((t) => t.id)));
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
      await createTag(name);
      setName('');
      void load();
    } catch (err) {
      setError(formatApiError(err, '添加失败'));
    }
  };

  const toggle = async (t: Tag) => {
    try {
      await updateTag(t.id, !t.enabled);
      void load();
    } catch (err) {
      setError(formatApiError(err, '更新失败'));
    }
  };

  const confirmRemove = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteTag(deleteTarget.id);
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
      <PageHeader title="标签管理" />
      {error && <p className="text-expense text-sm mb-4">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="field flex-1" placeholder="新标签" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0">添加</button>
      </form>
      <Notebook>
        {items.map((t) => (
          <div key={t.id} className="notebook-row flex justify-between items-center gap-3">
            <span className={`text-sm ${!t.enabled ? 'text-muted line-through' : 'text-ink'}`}>
              {t.name}{t.is_system && ' *'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => toggle(t)}
                className="btn-ghost p-1 text-muted hover:text-ink shrink-0"
                aria-label={t.enabled ? `隐藏标签「${t.name}」` : `显示标签「${t.name}」`}
              >
                {t.enabled ? <EyeIcon /> : <EyeOffIcon />}
              </button>
              {!t.is_system && !usedIds.has(t.id) && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(t)}
                  className="btn-ghost p-1 text-expense shrink-0"
                  aria-label={`删除标签「${t.name}」`}
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        ))}
      </Notebook>
      <ConfirmDialog
        open={deleteTarget != null}
        title="删除标签"
        message={deleteTarget ? `确定删除标签「${deleteTarget.name}」？` : ''}
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

export default function TagsPage() {
  return (
    <RequireAuth>
      <TagsContent />
    </RequireAuth>
  );
}
