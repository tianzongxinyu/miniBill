'use client';

import { TransactionsSearchCombobox } from '@/components/transactions/TransactionsSearchCombobox';
import { useTranslation } from 'react-i18next';

type StatsToolbarProps = {
  note: string;
  onNoteChange: (note: string) => void;
  selectedTagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
  contactId: number | null;
  onContactIdChange: (id: number | null) => void;
  onClear: () => void;
  mode: 'month' | 'year';
  onModeChange: (mode: 'month' | 'year') => void;
};

export function StatsToolbar({
  note,
  onNoteChange,
  selectedTagIds,
  onTagIdsChange,
  contactId,
  onContactIdChange,
  onClear,
  mode,
  onModeChange,
}: StatsToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="stats-toolbar mb-4">
      <TransactionsSearchCombobox
        note={note}
        onNoteChange={onNoteChange}
        selectedTagIds={selectedTagIds}
        onTagIdsChange={onTagIdsChange}
        contactId={contactId}
        onContactIdChange={onContactIdChange}
        onClear={onClear}
      />
      <div className="stats-toolbar-right shrink-0 flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange('month')}
          className={mode === 'month' ? 'btn-segment-active px-4' : 'btn-segment px-4'}
        >
          {t('stats.byMonth')}
        </button>
        <button
          type="button"
          onClick={() => onModeChange('year')}
          className={mode === 'year' ? 'btn-segment-active px-4' : 'btn-segment px-4'}
        >
          {t('stats.byYear')}
        </button>
      </div>
    </div>
  );
}
