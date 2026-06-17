'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { Notebook } from '@/components/ui/Notebook';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EyeIcon, EyeOffIcon } from '@/components/ui/VisibilityIcon';
import { TagChip } from '@/components/ui/TagChip';
import { TagColorPicker } from '@/components/ui/TagColorPicker';
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
  const [colorEditId, setColorEditId] = useState<number | null>(null);

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
      await updateTag(t.id, { enabled: !t.enabled });
      void load();
    } catch (err) {
      setError(formatApiError(err, '更新失败'));
    }
  };

  const saveColor = async (id: number, color_bg: string) => {
    try {
      const saved = await updateTag(id, { color_bg });
      setItems((prev) => prev.map((t) => (t.id === id ? saved : t)));
    } catch (err) {
      setError(formatApiError(err, '颜色保存失败'));
      throw err;
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
      {error && <p className="text-expense text-sm mb-4">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-4">
        <input className="field flex-1" placeholder="新标签" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0">添加</button>
      </form>
      <Notebook>
        {items.map((t) => (
          <div key={t.id} className="notebook-row">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className={!t.enabled ? 'opacity-45' : undefined}>
                  <TagChip name={t.name} colorBg={t.color_bg} />
                </span>
                {t.is_system && <span className="text-muted text-xs shrink-0">*</span>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setColorEditId((id) => (id === t.id ? null : t.id))}
                  className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                  aria-label={`修改标签「${t.name}」颜色`}
                  aria-expanded={colorEditId === t.id}
                >
                  <PaletteIcon />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                  aria-label={t.enabled ? `隐藏标签「${t.name}」` : `显示标签「${t.name}」`}
                >
                  {t.enabled ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                {!t.is_system && !usedIds.has(t.id) && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(t)}
                    className="btn-ghost p-1.5 text-expense shrink-0"
                    aria-label={`删除标签「${t.name}」`}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
            {colorEditId === t.id && (
              <TagColorPicker
                name={t.name}
                colorBg={t.color_bg}
                onSave={(bg) => saveColor(t.id, bg)}
                onClose={() => setColorEditId(null)}
              />
            )}
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
      <PageBackLink href="/profile/" />
    </div>
  );
}

function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-4.97 0-9 3.58-9 8 0 2.76 1.78 5.18 4.37 6.02.55.18.93.68.93 1.26 0 .74-.6 1.34-1.34 1.34h-.16C10.5 20.5 14.5 22 19 19.5 21.5 17.5 22 14.5 22 11c0-4.42-4.03-8-10-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8.5" cy="10.5" r="1.25" fill="currentColor" />
      <circle cx="12" cy="8" r="1.25" fill="currentColor" />
      <circle cx="15.5" cy="10.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

export default function TagsPage() {
  return (
    <RequireAuth>
      <TagsContent />
    </RequireAuth>
  );
}
