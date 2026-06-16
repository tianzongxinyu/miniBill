'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TagChip } from '@/components/ui/TagChip';
import { ContactChip } from '@/components/ui/ContactChip';
import { type Contact, type Tag } from '@/lib/api';
import { fetchEnabledTagsCached, fetchUsedContactsCached } from '@/lib/metaCache';
import { ComboboxFloatingClose } from '@/components/ui/ComboboxFloatingCandidates';
import { useClickOutside, useComboboxKeyboard } from '@/lib/combobox-utils';

type Candidate =
  | { kind: 'tag'; id: number; label: string; colorBg: string }
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const suppressOpenOnFocusRef = useRef(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const updateDropdownPos = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const toolbar = panel.closest('.transactions-toolbar, .stats-toolbar');
    const toolbarRect = toolbar?.getBoundingClientRect();
    const page = panel.closest('.max-w-3xl');
    const pageRect = page?.getBoundingClientRect();
    const pagePadX = window.matchMedia('(min-width: 1024px)').matches ? 32 : 16;

    if (toolbarRect) {
      setDropdownPos({
        top: panelRect.bottom + 8,
        left: toolbarRect.left,
        width: toolbarRect.width,
      });
      return;
    }

    if (pageRect) {
      setDropdownPos({
        top: panelRect.bottom + 8,
        left: pageRect.left + pagePadX,
        width: pageRect.width - pagePadX * 2,
      });
      return;
    }

    setDropdownPos({
      top: panelRect.bottom + 8,
      left: pagePadX,
      width: window.innerWidth - pagePadX * 2,
    });
  }, []);

  useClickOutside(rootRef, () => {
    setFocused(false);
    setDropdownOpen(false);
  });

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
      list.push({ kind: 'tag', id: t.id, label: t.name, colorBg: t.color_bg });
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

  const tagCandidates = useMemo(
    () => candidates.filter((c): c is Extract<Candidate, { kind: 'tag' }> => c.kind === 'tag'),
    [candidates]
  );

  const contactCandidates = useMemo(
    () =>
      candidates.filter((c): c is Extract<Candidate, { kind: 'contact' }> => c.kind === 'contact'),
    [candidates]
  );

  const showCandidates = focused && dropdownOpen && candidates.length > 0;

  useLayoutEffect(() => {
    if (!showCandidates) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPos();
    window.addEventListener('resize', updateDropdownPos);
    window.addEventListener('scroll', updateDropdownPos, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPos);
      window.removeEventListener('scroll', updateDropdownPos, true);
    };
  }, [showCandidates, updateDropdownPos]);

  const selectCandidate = useCallback(
    (c: Candidate) => {
      if (c.kind === 'tag') {
        if (!selectedTagIds.includes(c.id)) onTagIdsChange([...selectedTagIds, c.id]);
      } else {
        onContactIdChange(c.id);
      }
      onNoteChange('');
      setDropdownOpen(false);
      suppressOpenOnFocusRef.current = true;
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
    setOpen: setDropdownOpen,
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

  const handlePanelClick = useCallback(() => {
    void ensureCandidates();
    setFocused(true);
    setDropdownOpen(true);
    inputRef.current?.focus();
  }, [ensureCandidates]);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClear();
      setFocused(false);
      setDropdownOpen(false);
    },
    [onClear]
  );

  return (
    <div ref={rootRef} className="combobox min-w-0 flex-1">
      <div
        ref={panelRef}
        className={`combobox-panel${focused ? ' combobox-panel-focused' : ''}`}
        onClick={handlePanelClick}
      >
        <div className="combobox-panel-body">
          <div className="combobox-chip-row">
          {selectedTags.map((t) => (
            <TagChip
              key={`tag-${t.id}`}
              name={t.name}
              colorBg={t.color_bg}
              active
              className="combobox-chip"
              onRemove={() => removeTag(t.id)}
            />
          ))}
          {selectedContact && (
            <ContactChip
              key={`contact-${selectedContact.id}`}
              name={selectedContact.name}
              active
              className="combobox-chip"
              onRemove={removeContact}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            className="combobox-input-inline"
            placeholder={hasChips ? '备注关键词' : '备注 · 标签 · 联系人'}
            value={note}
            onChange={(e) => {
              onNoteChange(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => {
              void ensureCandidates();
              setFocused(true);
              if (!suppressOpenOnFocusRef.current) {
                setDropdownOpen(true);
              }
              suppressOpenOnFocusRef.current = false;
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

      {showCandidates && dropdownPos && (
        <div
          className="combobox-candidates-floating combobox-candidates-floating-fixed"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
          }}
          role="listbox"
        >
          <div className="combobox-candidates-floating-body">
            <ComboboxFloatingClose onClose={closeDropdown} />
            {tagCandidates.length > 0 && (
            <div className="combobox-candidates-row">
              {tagCandidates.map((c, i) => (
                <button
                  key={`${c.kind}-${c.id}`}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  className="combobox-candidate p-0 border-0 bg-transparent"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectCandidate(c)}
                >
                  <TagChip name={c.label} colorBg={c.colorBg} active={highlight === i} />
                </button>
              ))}
            </div>
          )}
          {contactCandidates.length > 0 && (
            <div className="combobox-candidates-row">
              {contactCandidates.map((c, i) => {
                const idx = tagCandidates.length + i;
                return (
                  <button
                    key={`${c.kind}-${c.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlight === idx}
                    className="combobox-candidate p-0 border-0 bg-transparent"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => selectCandidate(c)}
                  >
                    <ContactChip name={c.label} subtitle={c.subtitle} active={highlight === idx} />
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
