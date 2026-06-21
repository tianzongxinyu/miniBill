'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useSettings } from '@/components/SettingsProvider';
import { filterActiveStyleForType } from '@/lib/amountColors';

export function StatFilterButton({
  label,
  filterType,
  active,
  ariaLabel,
  onClick,
  children,
}: {
  label: string;
  filterType: 'expense' | 'income';
  active: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const { scheme } = useSettings();
  const activeStyle: CSSProperties | undefined = active
    ? filterActiveStyleForType(filterType, scheme)
    : undefined;

  return (
    <button
      type="button"
      className={`bill-stat-filter-btn bill-stat-filter-btn-${filterType}${active ? ' is-active ring-0' : ''}`}
      style={activeStyle}
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
    >
      <span className="bill-stat-stack-label">{label}</span>
      <span className="bill-stat-stack-value">{children}</span>
    </button>
  );
}
