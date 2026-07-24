'use client';

import { MonthPickerField } from '@/components/ui/MonthPickerField';
import { SearchFilterToolbar } from '@/components/ui/SearchFilterToolbar';
import type { TagMatch, YearMonth } from '@/lib/api';

type TransactionsToolbarProps = {
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
  searchActive: boolean;
  month: YearMonth;
  onMonthChange: (ym: YearMonth) => void;
  earliest: YearMonth | null;
  maxMonth: YearMonth;
};

export function TransactionsToolbar({
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
  searchActive,
  month,
  onMonthChange,
  earliest,
  maxMonth,
}: TransactionsToolbarProps) {
  return (
    <SearchFilterToolbar
      className="transactions-toolbar mb-4"
      note={note}
      onNoteChange={onNoteChange}
      selectedTagIds={selectedTagIds}
      onTagIdsChange={onTagIdsChange}
      contactId={contactId}
      onContactIdChange={onContactIdChange}
      tagMatch={tagMatch}
      onTagMatchChange={onTagMatchChange}
      matchToggleVisible={matchToggleVisible}
      onClear={onClear}
    >
      <MonthPickerField
        value={month}
        onChange={onMonthChange}
        min={earliest}
        max={maxMonth}
        disabled={searchActive}
      />
    </SearchFilterToolbar>
  );
}
