'use client';

import { useCallback, useMemo } from 'react';
import { ApiError, Contact, createContact } from '@/lib/api';
import { useComboboxKeyboard } from '@/lib/combobox-utils';
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
    setQuery,
    focused,
    setFocused,
    creating,
    rootRef,
    inputRef,
    trimmed,
    handleCreate,
  } = useCreatableCombobox({ onCreate });

  const selectContact = useCallback(
    (id: number) => {
      onChange(id);
      setQuery('');
      setFocused(false);
    },
    [onChange, setQuery, setFocused]
  );

  const clear = useCallback(() => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  }, [onChange, setQuery, inputRef]);

  const candidates = useMemo(() => {
    const pool = value ? contacts.filter((c) => c.id !== value) : contacts;
    const q = query.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q))
    );
  }, [contacts, query, value]);

  const canCreate =
    trimmed.length > 0 && !contacts.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const showCandidates = focused && (candidates.length > 0 || canCreate);

  const { highlight, setHighlight, onKeyDown } = useComboboxKeyboard({
    open: showCandidates,
    setOpen: setFocused,
    optionCount: candidates.length,
    hasCreate: canCreate,
    onSelect: (i) => selectContact(candidates[i].id),
    onCreate: handleCreate,
  });

  return (
    <div ref={rootRef} className="combobox">
      <div
        className={`combobox-panel${focused ? ' combobox-panel-focused' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <div className="combobox-chip-row">
          {selected && (
            <span className="tag-pill-active combobox-chip">
              {selected.name}
              <button
                type="button"
                className="combobox-chip-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                aria-label="清除联系人"
              >
                ×
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            className="combobox-input-inline"
            placeholder={selected ? '搜索或更换' : '输入联系人姓名'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={onKeyDown}
            autoComplete="off"
          />
        </div>

        {showCandidates && (
          <div className="combobox-candidates" role="listbox">
            {candidates.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={highlight === i}
                className={`tag-pill combobox-candidate${highlight === i ? ' combobox-candidate-active' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectContact(c.id)}
              >
                {c.name}
                {c.nickname ? <span className="combobox-candidate-muted"> · {c.nickname}</span> : null}
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
        )}
      </div>
    </div>
  );
}
