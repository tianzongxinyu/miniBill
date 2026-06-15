'use client';

import { MonthPickerField } from '@/components/ui/MonthPickerField';
import { TransactionsSearchCombobox } from '@/components/transactions/TransactionsSearchCombobox';
import type { YearMonth } from '@/lib/api';

type TransactionsToolbarProps = {
  note: string;
  onNoteChange: (note: string) => void;
  selectedTagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
  contactId: number | null;
  onContactIdChange: (id: number | null) => void;
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
  onClear,
  searchActive,
  month,
  onMonthChange,
  earliest,
  maxMonth,
}: TransactionsToolbarProps) {
  return (
    <div className="transactions-toolbar mb-4">
      <TransactionsSearchCombobox
        note={note}
        onNoteChange={onNoteChange}
        selectedTagIds={selectedTagIds}
        onTagIdsChange={onTagIdsChange}
        contactId={contactId}
        onContactIdChange={onContactIdChange}
        onClear={onClear}
      />
      <MonthPickerField
        value={month}
        onChange={onMonthChange}
        min={earliest}
        max={maxMonth}
        disabled={searchActive}
      />
    </div>
  );
}
