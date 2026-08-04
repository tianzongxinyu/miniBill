'use client';

import type { ReactNode } from 'react';
import { useSettings } from '@/components/SettingsProvider';
import { filterActiveStyleForType, filterInactiveStyleForType } from '@/lib/amountColors';

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
  const { scheme, theme } = useSettings();
  const style = active
    ? filterActiveStyleForType(filterType, scheme)
    : filterInactiveStyleForType(filterType, scheme);
  void theme;

  return (
    <button
      type="button"
      className={`bill-stat-filter-btn bill-stat-filter-btn-${filterType} ring-0${
        active ? ' is-active' : ' bill-stat-filter-btn-themed'
      }`}
      style={style}
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
