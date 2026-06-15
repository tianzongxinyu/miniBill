'use client';

import { useCallback, useMemo } from 'react';
import { ApiError, Tag, createTag } from '@/lib/api';
import { TagChip } from '@/components/ui/TagChip';
import { useComboboxKeyboard } from '@/lib/combobox-utils';
import { useCreatableCombobox } from '@/hooks/useCreatableCombobox';

type TagComboboxProps = {
  tags: Tag[];
  selectedIds: number[];
  /** 编辑回显：流水上的 tag_items，弥补 tags 列表尚未包含的项 */
  selectedItems?: Pick<Tag, 'id' | 'name' | 'color_bg' | 'color_fg'>[];
  onChange: (ids: number[]) => void;
  onTagsChange: (tags: Tag[]) => void;
};

export function TagCombobox({
  tags,
  selectedIds,
  selectedItems,
  onChange,
  onTagsChange,
}: TagComboboxProps) {
  const selectedTags = useMemo(() => {
    return selectedIds
      .map((id) => {
        const fromList = tags.find((t) => t.id === id);
        if (fromList) return fromList;
        const fromItems = selectedItems?.find((t) => t.id === id);
        if (fromItems) {
          return {
            id: fromItems.id,
            name: fromItems.name,
            color_bg: fromItems.color_bg,
            color_fg: fromItems.color_fg,
            is_system: false,
            enabled: true,
            selectable: true,
          } satisfies Tag;
        }
        return null;
      })
      .filter(Boolean) as Tag[];
  }, [selectedIds, tags, selectedItems]);

  const selectTag = useCallback(
    (id: number) => {
      if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    },
    [selectedIds, onChange]
  );

  const removeTag = useCallback(
    (id: number) => onChange(selectedIds.filter((x) => x !== id)),
    [selectedIds, onChange]
  );

  const onCreate = useCallback(
    async (name: string) => {
      const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        selectTag(existing.id);
        return;
      }
      try {
        const tag = await createTag(name);
        onTagsChange([...tags, tag]);
        onChange([...selectedIds, tag.id]);
      } catch (err) {
        if (err instanceof ApiError) {
          const existingAfter = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
          if (existingAfter) selectTag(existingAfter.id);
        }
      }
    },
    [tags, onTagsChange, onChange, selectedIds, selectTag]
  );

  const {
    query,
    setQuery,
    focused,
    setFocused,
    creating,
    rootRef,
    inputRef,
    trimmed,
    handleCreate,
  } = useCreatableCombobox({ onCreate });

  const candidates = useMemo(() => {
    const selectable = tags.filter((t) => t.selectable !== false);
    const unselected = selectable.filter((t) => !selectedIds.includes(t.id));
    const q = query.trim().toLowerCase();
    if (!q) return unselected;
    return unselected.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, selectedIds, query]);

  const canCreate =
    trimmed.length > 0 && !tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const showCandidates = focused && (candidates.length > 0 || canCreate);

  const { highlight, setHighlight, onKeyDown } = useComboboxKeyboard({
    open: showCandidates,
    setOpen: setFocused,
    optionCount: candidates.length,
    hasCreate: canCreate,
    onSelect: (i) => selectTag(candidates[i].id),
    onCreate: handleCreate,
    onRemoveLast: () => {
      if (selectedIds.length > 0) removeTag(selectedIds[selectedIds.length - 1]);
    },
  });

  return (
    <div ref={rootRef} className="combobox">
      <div
        className={`combobox-panel${focused ? ' combobox-panel-focused' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="combobox-chip-row">
          {selectedTags.map((t) => (
            <TagChip
              key={t.id}
              name={t.name}
              colorBg={t.color_bg}
              active
              className="combobox-chip"
              onRemove={() => removeTag(t.id)}
            />
          ))}
          <input
            ref={inputRef}
            type="text"
            className="combobox-input-inline"
            placeholder={selectedTags.length === 0 ? '输入标签名' : ''}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
        </div>
      </div>

      {showCandidates && (
        <div className="combobox-candidates-floating" role="listbox">
          <div className="combobox-candidates-row">
            {candidates.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={highlight === i}
                className="combobox-candidate p-0 border-0 bg-transparent"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  selectTag(t.id);
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <TagChip name={t.name} colorBg={t.color_bg} active={highlight === i} />
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                role="option"
                aria-selected={highlight === candidates.length}
                className={`tag-pill combobox-candidate combobox-candidate-create${highlight === candidates.length ? ' combobox-candidate-active' : ''}`}
                onMouseEnter={() => setHighlight(candidates.length)}
                onClick={handleCreate}
                disabled={creating}
              >
                + 创建「{trimmed}」
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
