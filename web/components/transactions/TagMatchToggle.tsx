'use client';

import { useTranslation } from 'react-i18next';
import type { TagMatch } from '@/lib/api/types';

export function TagMatchToggle({
  value,
  onChange,
  visible,
}: {
  value: TagMatch;
  onChange: (v: TagMatch) => void;
  visible: boolean;
}) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div className="tag-match-toggle" role="group" aria-label={t('filter.tagMatchLabel')}>
      <button
        type="button"
        onClick={() => onChange('all')}
        className={value === 'all' ? 'btn-segment-active' : 'btn-segment'}
      >
        {t('filter.matchAnd')}
      </button>
      <button
        type="button"
        onClick={() => onChange('any')}
        className={value === 'any' ? 'btn-segment-active' : 'btn-segment'}
      >
        {t('filter.matchOr')}
      </button>
    </div>
  );
}
