'use client';

import { useCallback, useRef, useState } from 'react';

type UseCreatableComboboxOptions = {
  onCreate: (name: string) => Promise<void>;
};

export function useCreatableCombobox({ onCreate }: UseCreatableComboboxOptions) {
  const [query, setQueryState] = useState('');
  const [focused, setFocused] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressOpenOnFocusRef = useRef(false);

  const trimmed = query.trim();

  const blur = useCallback(() => {
    setFocused(false);
    setDropdownOpen(false);
  }, []);

  const handleFocus = useCallback(() => {
    setFocused(true);
    if (!suppressOpenOnFocusRef.current) {
      setDropdownOpen(true);
    }
    suppressOpenOnFocusRef.current = false;
  }, []);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  const closeAndRefocusInput = useCallback(() => {
    setDropdownOpen(false);
    suppressOpenOnFocusRef.current = true;
    inputRef.current?.focus();
  }, []);

  const updateQuery = useCallback((value: string) => {
    setQueryState(value);
    setDropdownOpen(true);
  }, []);

  const resetQuery = useCallback(() => setQueryState(''), []);

  const handlePanelClick = useCallback(() => {
    setFocused(true);
    setDropdownOpen(true);
    inputRef.current?.focus();
  }, []);

  const handleCreate = useCallback(async () => {
    const name = trimmed;
    if (!name || creating) return;
    setCreating(true);
    try {
      await onCreate(name);
      resetQuery();
      suppressOpenOnFocusRef.current = true;
      setDropdownOpen(false);
    } finally {
      setCreating(false);
    }
  }, [trimmed, creating, onCreate, resetQuery]);

  return {
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
    blur,
    handleCreate,
  };
}
