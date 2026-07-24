'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  countSearchConditions,
  isTransactionSearchActive,
  type StatsSearchFilter,
  type TagMatch,
} from '@/lib/api';
import {
  matchToggleVisible,
  resolveApiTagMatch,
  resolveUiTagMatch,
  shouldResetTagMatch,
} from '@/lib/searchFilterMatch';

export function useDebouncedSearchFilter() {
  const [noteQuery, setNoteQuery] = useState('');
  const [debouncedNote, setDebouncedNote] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [contactId, setContactId] = useState<number | null>(null);
  const [tagMatch, setTagMatch] = useState<TagMatch>('all');

  useEffect(() => {
    if (!noteQuery.trim()) {
      setDebouncedNote('');
      return;
    }
    const t = window.setTimeout(() => setDebouncedNote(noteQuery), 300);
    return () => window.clearTimeout(t);
  }, [noteQuery]);

  const liveCount = useMemo(
    () =>
      countSearchConditions({
        note: noteQuery,
        tagIds: selectedTagIds,
        contactId,
      }),
    [noteQuery, selectedTagIds, contactId]
  );

  const settledCount = useMemo(
    () =>
      countSearchConditions({
        note: debouncedNote,
        tagIds: selectedTagIds,
        contactId,
      }),
    [debouncedNote, selectedTagIds, contactId]
  );

  useEffect(() => {
    if (shouldResetTagMatch(liveCount) && tagMatch !== 'all') {
      setTagMatch('all');
    }
  }, [liveCount, tagMatch]);

  const effectiveTagMatch = resolveApiTagMatch(settledCount, tagMatch);
  const uiTagMatch = resolveUiTagMatch(liveCount, tagMatch);
  const showMatchToggle = matchToggleVisible(liveCount);

  const searchActive = useMemo(
    () => isTransactionSearchActive({ note: debouncedNote, tagIds: selectedTagIds, contactId }),
    [debouncedNote, selectedTagIds, contactId]
  );

  const searchFilter = useMemo<StatsSearchFilter>(
    () => ({
      note: debouncedNote.trim() || undefined,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      contactId,
      tagMatch: effectiveTagMatch,
    }),
    [debouncedNote, selectedTagIds, contactId, effectiveTagMatch]
  );

  const clearSearch = useCallback(() => {
    setNoteQuery('');
    setDebouncedNote('');
    setSelectedTagIds([]);
    setContactId(null);
    setTagMatch('all');
  }, []);

  const hydrateSearchFilters = useCallback(
    (f: {
      note?: string;
      tagIds?: number[];
      contactId?: number | null;
      tagMatch?: TagMatch;
    }) => {
      if (f.note !== undefined) {
        setNoteQuery(f.note);
        setDebouncedNote(f.note.trim());
      }
      if (f.tagIds !== undefined) setSelectedTagIds(f.tagIds);
      if (f.contactId !== undefined) setContactId(f.contactId);
      if (f.tagMatch !== undefined) setTagMatch(f.tagMatch);
    },
    []
  );

  return {
    noteQuery,
    setNoteQuery,
    debouncedNote,
    selectedTagIds,
    setSelectedTagIds,
    contactId,
    setContactId,
    tagMatch: uiTagMatch,
    setTagMatch,
    apiTagMatch: effectiveTagMatch,
    matchToggleVisible: showMatchToggle,
    conditionCount: settledCount,
    searchActive,
    searchFilter,
    clearSearch,
    hydrateSearchFilters,
  };
}
