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
import { TagChip } from '@/components/ui/TagChip';
import { TagColorPicker } from '@/components/ui/TagColorPicker';
import { useManagedEntityList } from '@/hooks/useManagedEntityList';
import {
  createTag,
  deleteTag,
  fetchUsedTransactionTags,
  updateTag,
  type Tag,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { buildTagDetailHref } from '@/lib/url';

function TagsContent() {
  const { t } = useTranslation();
  const [colorEditId, setColorEditId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const skipBlurSave = useRef(false);
  const savingRef = useRef(false);
  const {
    items,
    setItems,
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
  } = useManagedEntityList<Tag>({
    listPath: '/tags',
    fetchUsed: fetchUsedTransactionTags,
    createItem: createTag,
    deleteItem: deleteTag,
    createErrorFallback: t('tags.addFailed'),
  });

  const toggle = async (tag: Tag) => {
    try {
      await updateTag(tag.id, { enabled: !tag.enabled });
      void load();
    } catch (err) {
      setError(formatApiError(err, t('tags.updateFailed')));
    }
  };

  const saveColor = async (id: number, color_bg: string) => {
    try {
      const saved = await updateTag(id, { color_bg });
      setItems((prev) => prev.map((item) => (item.id === id ? saved : item)));
    } catch (err) {
      setError(formatApiError(err, t('tags.colorSaveFailed')));
      throw err;
    }
  };

  const startEdit = (tag: Tag) => {
    skipBlurSave.current = false;
    setColorEditId(null);
    setEditingId(tag.id);
    setEditName(tag.name);
    setError('');
  };

  const cancelEdit = () => {
    skipBlurSave.current = true;
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (tag: Tag) => {
    if (savingRef.current) return;
    const next = editName.trim();
    if (!next || next === tag.name) {
      cancelEdit();
      return;
    }
    const taken = items.some(
      (item) => item.id !== tag.id && item.name.localeCompare(next, undefined, { sensitivity: 'accent' }) === 0
    );
    if (taken) {
      setError(t('tags.nameTaken'));
      return;
    }
    savingRef.current = true;
    setRenaming(true);
    try {
      const saved = await updateTag(tag.id, { name: next });
      setItems((prev) => prev.map((item) => (item.id === tag.id ? saved : item)));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      setError(formatApiError(err, t('tags.renameFailed')));
    } finally {
      savingRef.current = false;
      setRenaming(false);
    }
  };

  return (
    <div className="page-detail-with-floating-back">
      {error && <p className="text-expense text-sm mb-2">{error}</p>}
      <form onSubmit={create} className="flex gap-2 mb-2">
        <input className="field flex-1" placeholder={t('tags.newPlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0">{t('tags.add')}</button>
      </form>
      <Notebook>
        {items.map((tag) => {
          const editing = editingId === tag.id;
          return (
            <div key={tag.id} className="notebook-row">
              <div className="flex justify-between items-start gap-3">
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
                        void saveEdit(tag);
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
                      void saveEdit(tag);
                    }}
                    aria-label={t('tags.editName', { name: tag.name })}
                  />
                ) : (
                  <Link
                    href={buildTagDetailHref({ tagId: tag.id, returnTo: '/profile/tags/' })}
                    className="flex items-center gap-1.5 min-w-0 flex-1"
                  >
                    <span className={!tag.enabled ? 'opacity-45' : undefined}>
                      <TagChip name={tag.name} colorBg={tag.color_bg} />
                    </span>
                    {tag.is_system && <span className="text-muted text-xs shrink-0">*</span>}
                  </Link>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  {!tag.is_system && !editing && (
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                      aria-label={t('tags.editName', { name: tag.name })}
                    >
                      <EditIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setColorEditId((id) => (id === tag.id ? null : tag.id))}
                    className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                    aria-label={t('tags.changeColor', { name: tag.name })}
                    aria-expanded={colorEditId === tag.id}
                  >
                    <PaletteIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(tag)}
                    className="btn-ghost p-1.5 text-muted hover:text-ink shrink-0"
                    aria-label={tag.enabled ? t('tags.hideTag', { name: tag.name }) : t('tags.showTag', { name: tag.name })}
                  >
                    {tag.enabled ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  {!tag.is_system && !usedIds.has(tag.id) && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tag)}
                      className="btn-ghost p-1.5 text-expense shrink-0"
                      aria-label={t('tags.deleteTag', { name: tag.name })}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
              {colorEditId === tag.id && (
                <TagColorPicker
                  name={tag.name}
                  colorBg={tag.color_bg}
                  onSave={(bg) => saveColor(tag.id, bg)}
                  onClose={() => setColorEditId(null)}
                />
              )}
            </div>
          );
        })}
      </Notebook>
      <ConfirmDialog
        open={deleteTarget != null}
        title={t('tags.deleteTitle')}
        message={deleteTarget ? t('tags.deleteMessage', { name: deleteTarget.name }) : ''}
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
