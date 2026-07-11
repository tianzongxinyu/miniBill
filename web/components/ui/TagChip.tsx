'use client';

import { TAG_TEXT_COLOR } from '@/lib/tagColors';
import { useTranslation } from 'react-i18next';

type TagChipProps = {
  name: string;
  colorBg?: string;
  /** 选中 / 强调态（筛选、已选标签） */
  active?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onRemove?: () => void;
};

const DEFAULT_BG = '#3B6FA8';

export function TagChip({
  name,
  colorBg,
  active = false,
  className = '',
  onClick,
  onRemove,
}: TagChipProps) {
  const { t } = useTranslation();
  const bg = colorBg || DEFAULT_BG;
  const clickable = Boolean(onClick);

  return (
    <span
      className={`tag-chip ${active ? 'font-medium ring-2 ring-white/40' : ''} ${clickable ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
      style={{
        backgroundColor: bg,
        color: TAG_TEXT_COLOR,
        boxShadow: active ? `0 0 0 1px ${bg}` : undefined,
      }}
      onClick={onClick}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          className="combobox-chip-remove opacity-80 hover:opacity-100"
          style={{ color: TAG_TEXT_COLOR }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t('common.removeItem', { name })}
        >
          ×
        </button>
      )}
    </span>
  );
}
