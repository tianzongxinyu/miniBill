'use client';

import { useCallback, useMemo, useRef } from 'react';
import { ApiError, Contact, createContact } from '@/lib/api';
import { ContactChip } from '@/components/ui/ContactChip';
import { ComboboxFloatingCandidates } from '@/components/ui/ComboboxFloatingCandidates';
import { useClickOutside, useComboboxKeyboard } from '@/lib/combobox-utils';
import { useCreatableCombobox } from '@/hooks/useCreatableCombobox';

type ContactComboboxProps = {
  contacts: Contact[];
  value: number | '';
  onChange: (id: number | '') => void;
  onContactsChange: (contacts: Contact[]) => void;
};

export function ContactCombobox({ contacts, value, onChange, onContactsChange }: ContactComboboxProps) {
  const selected = useMemo(
    () => (value ? contacts.find((c) => c.id === value) : undefined),
    [value, contacts]
  );

  const onCreate = useCallback(
    async (name: string) => {
      const existing = contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        onChange(existing.id);
        return;
      }
      try {
        const contact = await createContact(name);
        onContactsChange([...contacts, contact]);
        onChange(contact.id);
      } catch (err) {
        if (err instanceof ApiError) {
          const existingAfter = contacts.find((c) => c.name.toLowerCase() === name.toLowerCase());
          if (existingAfter) onChange(existingAfter.id);
        }
      }
    },
    [contacts, onContactsChange, onChange]
  );

  const {
    query,
    updateQuery,
    resetQuery,
    focused,
    dropdownOpen,
    setDropdownOpen,
    handleFocus,
    handlePanelClick,
    closeDropdown,
    closeAndRefocusInput,
    creating,
    rootRef,
    inputRef,
    trimmed,
    handleCreate,
    blur,
  } = useCreatableCombobox({ onCreate });

  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside([rootRef, dropdownRef], blur);

  const selectContact = useCallback(
    (id: number) => {
      onChange(id);
      resetQuery();
      closeAndRefocusInput();
    },
    [onChange, resetQuery, closeAndRefocusInput]
  );

  const clear = useCallback(() => {
    onChange('');
    resetQuery();
    inputRef.current?.focus();
  }, [onChange, resetQuery, inputRef]);

  const candidates = useMemo(() => {
    const pool = value ? contacts.filter((c) => c.id !== value) : contacts;
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? pool
      : pool.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.nickname && c.nickname.toLowerCase().includes(q))
        );
    return [...filtered].sort(
      (a, b) =>
        (b.usage_count ?? 0) - (a.usage_count ?? 0) ||
        a.name.localeCompare(b.name, 'zh-CN')
    );
  }, [contacts, query, value]);

  const canCreate =
    trimmed.length > 0 && !contacts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const showCandidates = focused && dropdownOpen && (candidates.length > 0 || canCreate);

  const { highlight, setHighlight, onKeyDown } = useComboboxKeyboard({
    open: showCandidates,
    setOpen: setDropdownOpen,
    optionCount: candidates.length,
    hasCreate: canCreate,
    onSelect: (i) => selectContact(candidates[i].id),
    onCreate: handleCreate,
  });

  return (
    <div ref={rootRef} className="combobox">
      <div
        ref={panelRef}
        className={`combobox-panel${focused ? ' combobox-panel-focused' : ''}`}
        onClick={handlePanelClick}
      >
        <div className="combobox-chip-row">
          {selected && (
            <ContactChip
              name={selected.name}
              active
              className="combobox-chip"
              onRemove={clear}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            className="combobox-input-inline"
            placeholder={selected ? '搜索或更换' : '输入联系人姓名'}
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
        </div>
      </div>

      <ComboboxFloatingCandidates
        open={showCandidates}
        panelRef={panelRef}
        dropdownRef={dropdownRef}
        onClose={closeDropdown}
      >
        <div className="combobox-candidates-row">
          {candidates.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={highlight === i}
              className="combobox-candidate p-0 border-0 bg-transparent"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => selectContact(c.id)}
            >
              <ContactChip name={c.name} subtitle={c.nickname || undefined} active={highlight === i} />
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
      </ComboboxFloatingCandidates>
    </div>
  );
}
