'use client';

import { CONTACT_CHIP_BG, CONTACT_CHIP_FG } from '@/lib/tagColors';
import { useTranslation } from 'react-i18next';

type ContactChipProps = {
  name: string;
  /** 选中 / 键盘高亮 */
  active?: boolean;
  className?: string;
  subtitle?: string;
  onRemove?: () => void;
};

export function ContactChip({
  name,
  active = false,
  className = '',
  subtitle,
  onRemove,
}: ContactChipProps) {
  const { t } = useTranslation();
  return (
    <span
      className={`tag-chip ${active ? 'font-medium ring-2 ring-accent/30' : ''} ${className}`}
      style={{
        backgroundColor: CONTACT_CHIP_BG,
        color: CONTACT_CHIP_FG,
        boxShadow: active ? `0 0 0 1px ${CONTACT_CHIP_FG}` : undefined,
      }}
    >
      @{name}
      {subtitle && (
        <span className="opacity-70 font-normal"> · {subtitle}</span>
      )}
      {onRemove && (
        <button
          type="button"
          className="combobox-chip-remove opacity-80 hover:opacity-100"
          style={{ color: CONTACT_CHIP_FG }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={t('common.removeContact', { name })}
        >
          ×
        </button>
      )}
    </span>
  );
}
