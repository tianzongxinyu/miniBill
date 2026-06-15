'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { type Contact, type Tag } from '@/lib/api';
import { fetchEnabledTagsCached, fetchUsedContactsCached } from '@/lib/metaCache';
import { useClickOutside, useComboboxKeyboard } from '@/lib/combobox-utils';

type Candidate =
  | { kind: 'tag'; id: number; label: string }
  | { kind: 'contact'; id: number; label: string; subtitle?: string };

type TransactionsSearchComboboxProps = {
  note: string;
  onNoteChange: (note: string) => void;
  selectedTagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
  contactId: number | null;
  onContactIdChange: (id: number | null) => void;
  onClear: () => void;
};

export function TransactionsSearchCombobox({
  note,
  onNoteChange,
  selectedTagIds,
  onTagIdsChange,
  contactId,
  onContactIdChange,
  onClear,
}: TransactionsSearchComboboxProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  useClickOutside(rootRef, () => setFocused(false));

  const ensureCandidates = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const [tagItems, contactItems] = await Promise.all([
        fetchEnabledTagsCached(),
        fetchUsedContactsCached(),
      ]);
      setTags(tagItems);
      setContacts(contactItems);
    } catch {
      loadedRef.current = false;
    }
  }, []);

  const selectedTags = useMemo(
    () => selectedTagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[],
    [selectedTagIds, tags]
  );

  const selectedContact = useMemo(
    () => (contactId != null ? contacts.find((c) => c.id === contactId) : undefined),
    [contactId, contacts]
  );

  const candidates = useMemo(() => {
    const q = note.trim().toLowerCase();
    const list: Candidate[] = [];

    for (const t of tags) {
      if (selectedTagIds.includes(t.id)) continue;
      if (q && !t.name.toLowerCase().includes(q)) continue;
      list.push({ kind: 'tag', id: t.id, label: t.name });
    }
    if (contactId == null) {
      for (const c of contacts) {
        const hay = `${c.name} ${c.nickname}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        list.push({
          kind: 'contact',
          id: c.id,
          label: c.name,
          subtitle: c.nickname || undefined,
        });
      }
    }
    return list;
  }, [tags, contacts, note, selectedTagIds, contactId]);

  const showCandidates = focused && candidates.length > 0;

  const selectCandidate = useCallback(
    (c: Candidate) => {
      if (c.kind === 'tag') {
        if (!selectedTagIds.includes(c.id)) onTagIdsChange([...selectedTagIds, c.id]);
      } else {
        onContactIdChange(c.id);
      }
      onNoteChange('');
      inputRef.current?.focus();
    },
    [selectedTagIds, onTagIdsChange, onContactIdChange, onNoteChange]
  );

  const removeTag = useCallback(
    (id: number) => onTagIdsChange(selectedTagIds.filter((x) => x !== id)),
    [selectedTagIds, onTagIdsChange]
  );

  const removeContact = useCallback(() => onContactIdChange(null), [onContactIdChange]);

  const { highlight, setHighlight, onKeyDown } = useComboboxKeyboard({
    open: showCandidates,
    setOpen: setFocused,
    optionCount: candidates.length,
    hasCreate: false,
    onSelect: (i) => selectCandidate(candidates[i]),
    onCreate: () => {},
    onRemoveLast: () => {
      if (note.trim()) return;
      if (selectedTagIds.length > 0) {
        removeTag(selectedTagIds[selectedTagIds.length - 1]);
        return;
      }
      if (contactId != null) removeContact();
    },
  });

  const hasChips = selectedTags.length > 0 || selectedContact != null;
  const hasValue = Boolean(note.trim()) || selectedTagIds.length > 0 || contactId != null;

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClear();
      setFocused(false);
    },
    [onClear]
  );

  return (
    <div ref={rootRef} className="combobox min-w-0 flex-1">
      <div
        className={`combobox-panel${focused ? ' combobox-panel-focused' : ''}`}
        onClick={() => {
          void ensureCandidates();
          inputRef.current?.focus();
        }}
      >
        <div className="combobox-panel-body">
          <div className="combobox-chip-row">
          {selectedTags.map((t) => (
            <span key={`tag-${t.id}`} className="tag-pill-active combobox-chip">
              {t.name}
              <button
                type="button"
                className="combobox-chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(t.id);
                }}
                aria-label={`移除标签 ${t.name}`}
              >
                ×
              </button>
            </span>
          ))}
          {selectedContact && (
            <span key={`contact-${selectedContact.id}`} className="tag-pill-active combobox-chip">
              {selectedContact.name}
              <button
                type="button"
                className="combobox-chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeContact();
                }}
                aria-label={`移除联系人 ${selectedContact.name}`}
              >
                ×
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            className="combobox-input-inline"
            placeholder={hasChips ? '备注关键词' : '备注 · 标签 · 联系人'}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            onFocus={() => {
              void ensureCandidates();
              setFocused(true);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
          </div>
          {hasValue && (
            <button
              type="button"
              className="combobox-clear"
              onClick={clearAll}
              aria-label="清除检索"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showCandidates && (
        <div className="combobox-candidates-floating" role="listbox">
          {candidates.map((c, i) => (
            <button
              key={`${c.kind}-${c.id}`}
              type="button"
              role="option"
              aria-selected={highlight === i}
              className={`tag-pill combobox-candidate${highlight === i ? ' combobox-candidate-active' : ''}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => selectCandidate(c)}
            >
              {c.kind === 'contact' && (
                <span className="combobox-candidate-muted">联系人 · </span>
              )}
              {c.label}
              {c.kind === 'contact' && c.subtitle ? (
                <span className="combobox-candidate-muted"> · {c.subtitle}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
