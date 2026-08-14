'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';
import { useClickOutside } from '@/lib/combobox-utils';

const WEEKDAY_KEYS = [
  'picker.weekdayMon',
  'picker.weekdayTue',
  'picker.weekdayWed',
  'picker.weekdayThu',
  'picker.weekdayFri',
  'picker.weekdaySat',
  'picker.weekdaySun',
] as const;

const MAX_DAY = 28;

/** Build a Monday-start month grid for a fixed 31-day layout; only days 1–28 are selectable. */
function buildDayCells(): { day: number; inMonth: boolean }[] {
  // Use a month that starts on Monday for a clean grid: 2023-05 starts Monday.
  const startOffset = 0;
  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: 0, inMonth: false });
  }
  for (let day = 1; day <= 31; day++) {
    cells.push({ day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, inMonth: false });
  }
  return cells;
}

type DayOfMonthPickerProps = {
  value: number;
  onChange: (day: number) => void;
};

export function DayOfMonthPicker({ value, onChange }: DayOfMonthPickerProps) {
  const { t } = useTranslation();
  const weekdayLabels = useMemo(() => WEEKDAY_KEYS.map((key) => t(key)), [t]);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const cells = useMemo(() => buildDayCells(), []);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside([rootRef, floatingPanelRef], close);

  const selectDay = (day: number) => {
    if (day < 1 || day > MAX_DAY) return;
    onChange(day);
    close();
  };

  return (
    <div ref={rootRef} className="date-picker">
      <button
        ref={fieldRef}
        type="button"
        className={`date-picker-field${open ? ' date-picker-field-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="date-picker-field-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
        <span className="date-picker-field-value tabular-nums">
          {t('recurring.dayOfMonthShort', { day: value })}
        </span>
        <span className={`date-picker-field-chevron${open ? ' date-picker-field-chevron-open' : ''}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <FloatingPickerPortal
        open={open}
        anchorRef={fieldRef}
        panelRef={floatingPanelRef}
        onClose={close}
        role="dialog"
        aria-label={t('recurring.dayOfMonth')}
        widthMode="page"
      >
        <div className="date-picker-header">
          <span className="date-picker-title text-sm font-medium">{t('recurring.dayOfMonth')}</span>
        </div>
        <div className="date-picker-weekdays">
          {weekdayLabels.map((w) => (
            <span key={w} className="date-picker-weekday">
              {w}
            </span>
          ))}
        </div>
        <div className="date-picker-grid">
          {cells.map(({ day, inMonth }, idx) => {
            if (!inMonth || day < 1) {
              return <span key={`pad-${idx}`} className="date-picker-day date-picker-day-outside" />;
            }
            const disabled = day > MAX_DAY;
            const selected = day === value;
            return (
              <button
                key={day}
                type="button"
                className={[
                  'date-picker-day',
                  selected && 'date-picker-day-selected',
                  disabled && 'date-picker-day-disabled',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectDay(day)}
                disabled={disabled}
                tabIndex={disabled ? -1 : 0}
              >
                {day}
              </button>
            );
          })}
        </div>
      </FloatingPickerPortal>
    </div>
  );
}
