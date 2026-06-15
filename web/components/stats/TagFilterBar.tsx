'use client';

import type { Tag } from '@/lib/api';

export function TagFilterBar({
  tags,
  selectedIds,
  onChange,
}: {
  tags: Tag[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const enabled = tags.filter((t) => t.enabled);

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  if (enabled.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs text-muted mb-2">标签筛选（多选，同时包含所选标签）</div>
      <div className="flex flex-wrap gap-2">
        {enabled.map((t) => {
          const active = selectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={active ? 'tag-pill-active' : 'tag-pill'}
            >
              {t.name}
            </button>
          );
        })}
        {selectedIds.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="btn-ghost px-2 text-xs">
            清除
          </button>
        )}
      </div>
    </div>
  );
}
