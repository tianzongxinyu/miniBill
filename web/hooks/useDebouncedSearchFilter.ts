'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isTransactionSearchActive, type StatsSearchFilter } from '@/lib/api';

export function useDebouncedSearchFilter() {
  const [noteQuery, setNoteQuery] = useState('');
  const [debouncedNote, setDebouncedNote] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [contactId, setContactId] = useState<number | null>(null);

  useEffect(() => {
    if (!noteQuery.trim()) {
      setDebouncedNote('');
      return;
    }
    const t = window.setTimeout(() => setDebouncedNote(noteQuery), 300);
    return () => window.clearTimeout(t);
  }, [noteQuery]);

  const searchActive = useMemo(
    () => isTransactionSearchActive({ note: debouncedNote, tagIds: selectedTagIds, contactId }),
    [debouncedNote, selectedTagIds, contactId]
  );

  const searchFilter = useMemo<StatsSearchFilter>(
    () => ({
      note: debouncedNote.trim() || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      contactId,
    }),
    [debouncedNote, selectedTagIds, contactId]
  );

  const clearSearch = useCallback(() => {
    setNoteQuery('');
    setDebouncedNote('');
    setSelectedTagIds([]);
    setContactId(null);
  }, []);

  return {
    noteQuery,
    setNoteQuery,
    debouncedNote,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    searchActive,
    searchFilter,
    clearSearch,
  };
}
