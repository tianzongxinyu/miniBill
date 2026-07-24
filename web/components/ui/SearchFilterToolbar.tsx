'use client';

import type { ReactNode } from 'react';
import { TransactionsSearchCombobox } from '@/components/transactions/TransactionsSearchCombobox';
import { TagMatchToggle } from '@/components/transactions/TagMatchToggle';
import type { TagMatch } from '@/lib/api';

type SearchFilterToolbarProps = {
  className: string;
  note: string;
  onNoteChange: (note: string) => void;
  selectedTagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
  contactId: number | null;
  onContactIdChange: (id: number | null) => void;
  tagMatch: TagMatch;
  onTagMatchChange: (match: TagMatch) => void;
  matchToggleVisible: boolean;
  onClear: () => void;
  children: ReactNode;
};

export function SearchFilterToolbar({
  className,
  note,
  onNoteChange,
  selectedTagIds,
  onTagIdsChange,
  contactId,
  onContactIdChange,
  tagMatch,
  onTagMatchChange,
  matchToggleVisible,
  onClear,
  children,
}: SearchFilterToolbarProps) {
  return (
    <div className={className}>
      <div className="toolbar-search">
        <div className="toolbar-search-field">
          <TransactionsSearchCombobox
            note={note}
            onNoteChange={onNoteChange}
            selectedTagIds={selectedTagIds}
            onTagIdsChange={onTagIdsChange}
            contactId={contactId}
            onContactIdChange={onContactIdChange}
            onClear={onClear}
          />
        </div>
        <TagMatchToggle
          value={tagMatch}
          onChange={onTagMatchChange}
          visible={matchToggleVisible}
        />
      </div>
      {children}
    </div>
  );
}
