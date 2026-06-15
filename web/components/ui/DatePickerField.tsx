'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClickOutside } from '@/lib/combobox-utils';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatDisplayDate(iso: string): string {
  const p = parseISO(iso);
  if (!p) return '选择日期';
  return `${p.y} 年 ${p.m} 月 ${p.d} 日`;
}

function todayISO(): string {
  const t = new Date();
  return toISO(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function monthRange(y: number, m: number): { first: string; last: string } {
  return { first: toISO(y, m, 1), last: toISO(y, m, daysInMonth(y, m)) };
}

function isDisabled(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return true;
  if (max && iso > max) return true;
  return false;
}

type CalendarDay = {
  iso: string;
  day: number;
  inMonth: boolean;
};

function buildCalendarDays(viewYear: number, viewMonth: number): CalendarDay[] {
  const first = new Date(viewYear, viewMonth - 1, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const total = daysInMonth(viewYear, viewMonth);
  const cells: CalendarDay[] = [];

  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
  const prevTotal = daysInMonth(prevYear, prevMonth);

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevTotal - i;
    cells.push({ iso: toISO(prevYear, prevMonth, day), day, inMonth: false });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ iso: toISO(viewYear, viewMonth, day), day, inMonth: true });
  }
  const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
  const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ iso: toISO(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false });
    nextDay++;
  }
  return cells;
}

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
};

export function DatePickerField({ value, onChange, min, max, required }: DatePickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = parseISO(value);
  const fallback = parseISO(todayISO())!;
  const [viewYear, setViewYear] = useState(parsed?.y ?? fallback.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? fallback.m);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
    }
  }, [open, parsed?.y, parsed?.m]);

  const today = todayISO();
  const days = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonthNav = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const prevYM = viewMonth === 1 ? { y: viewYear - 1, m: 12 } : { y: viewYear, m: viewMonth - 1 };
  const nextYM = viewMonth === 12 ? { y: viewYear + 1, m: 1 } : { y: viewYear, m: viewMonth + 1 };
  const prevDisabled = min ? monthRange(prevYM.y, prevYM.m).last < min : false;
  const nextDisabled = max ? monthRange(nextYM.y, nextYM.m).first > max : false;

  const selectDay = (iso: string) => {
    if (isDisabled(iso, min, max)) return;
    onChange(iso);
    setOpen(false);
  };

  const selectToday = () => {
    if (!isDisabled(today, min, max)) selectDay(today);
  };

  return (
    <div ref={rootRef} className="date-picker">
      <button
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
        <span className="date-picker-field-value tabular-nums">{formatDisplayDate(value)}</span>
        <span className={`date-picker-field-chevron${open ? ' date-picker-field-chevron-open' : ''}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="date-picker-panel" role="dialog" aria-label="选择日期">
          <div className="date-picker-header">
            <button
              type="button"
              className="date-picker-nav"
              onClick={prevMonth}
              disabled={prevDisabled}
              aria-label="上个月"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="date-picker-title tabular-nums">
              {viewYear} 年 {viewMonth} 月
            </span>
            <button
              type="button"
              className="date-picker-nav"
              onClick={nextMonthNav}
              disabled={nextDisabled}
              aria-label="下个月"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="date-picker-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="date-picker-weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="date-picker-grid">
            {days.map(({ iso, day, inMonth }) => {
              const disabled = !inMonth || isDisabled(iso, min, max);
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={`${iso}-${inMonth ? 'in' : 'out'}`}
                  type="button"
                  className={[
                    'date-picker-day',
                    !inMonth && 'date-picker-day-outside',
                    selected && 'date-picker-day-selected',
                    isToday && !selected && 'date-picker-day-today',
                    disabled && 'date-picker-day-disabled',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDay(iso)}
                  disabled={disabled}
                  tabIndex={disabled ? -1 : 0}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button
              type="button"
              className="date-picker-today"
              onClick={selectToday}
              disabled={isDisabled(today, min, max)}
            >
              今天
            </button>
          </div>
        </div>
      )}

      <input type="hidden" value={value} required={required} tabIndex={-1} readOnly aria-hidden />
    </div>
  );
}
