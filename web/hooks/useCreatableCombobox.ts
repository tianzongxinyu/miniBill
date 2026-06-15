'use client';

import { useCallback, useRef, useState } from 'react';

type UseCreatableComboboxOptions = {
  onCreate: (name: string) => Promise<void>;
};

export function useCreatableCombobox({ onCreate }: UseCreatableComboboxOptions) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const blur = useCallback(() => setFocused(false), []);

  const handleCreate = useCallback(async () => {
    const name = trimmed;
    if (!name || creating) return;
    setCreating(true);
    try {
      await onCreate(name);
      setQuery('');
    } finally {
      setCreating(false);
    }
  }, [trimmed, creating, onCreate]);

  return {
    query,
    setQuery,
    focused,
    setFocused,
    creating,
    rootRef,
    inputRef,
    trimmed,
    blur,
    handleCreate,
  };
}
