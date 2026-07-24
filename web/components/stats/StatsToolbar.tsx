'use client';

import { SearchFilterToolbar } from '@/components/ui/SearchFilterToolbar';
import type { TagMatch } from '@/lib/api';
import { useTranslation } from 'react-i18next';

type StatsToolbarProps = {
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
  tagMatch,
  onTagMatchChange,
  matchToggleVisible,
  onClear,
  mode,
  onModeChange,
}: StatsToolbarProps) {
  const { t } = useTranslation();

  return (
    <SearchFilterToolbar
      className="stats-toolbar mb-4"
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
      <div className="stats-toolbar-right shrink-0 flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange('month')}
          className={mode === 'month' ? 'btn-segment-active' : 'btn-segment'}
        >
          {t('stats.byMonth')}
        </button>
        <button
          type="button"
          onClick={() => onModeChange('year')}
          className={mode === 'year' ? 'btn-segment-active' : 'btn-segment'}
        >
          {t('stats.byYear')}
        </button>
      </div>
    </SearchFilterToolbar>
  );
}
