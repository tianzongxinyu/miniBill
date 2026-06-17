'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compareYearMonth, type YearMonth } from '@/lib/api';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const YEARS_PER_PAGE = 12;

function yearPageStart(y: number): number {
  return Math.floor((y - 1) / YEARS_PER_PAGE) * YEARS_PER_PAGE + 1;
}

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

function yearMonthFromISO(iso?: string): YearMonth | null {
  if (!iso) return null;
  const p = parseISO(iso);
  if (!p) return null;
  return { year: p.y, month: p.m };
}

function yearFromISO(iso?: string): number | null {
  return yearMonthFromISO(iso)?.year ?? null;
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
  const fieldRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'day' | 'month' | 'year'>('day');

  const parsed = parseISO(value);
  const fallback = parseISO(todayISO())!;
  const [viewYear, setViewYear] = useState(parsed?.y ?? fallback.y);
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? fallback.m);
  const [viewYearPageStart, setViewYearPageStart] = useState(() => yearPageStart(parsed?.y ?? fallback.y));

  const minYM = yearMonthFromISO(min);
  const maxYM = yearMonthFromISO(max);
  const minYear = yearFromISO(min);
  const maxYear = yearFromISO(max);

  const close = useCallback(() => {
    setOpen(false);
    setPanelMode('day');
  }, []);

  useClickOutside([rootRef, floatingPanelRef], close);

  useEffect(() => {
    if (open && parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
      setViewYearPageStart(yearPageStart(parsed.y));
      setPanelMode('day');
    }
  }, [open, parsed?.y, parsed?.m]);

  const yearPageYears = useMemo(
    () => Array.from({ length: YEARS_PER_PAGE }, (_, i) => viewYearPageStart + i),
    [viewYearPageStart]
  );

  const today = todayISO();
  const days = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const isMonthDisabled = useCallback(
    (y: number, m: number) => {
      const ym = { year: y, month: m };
      if (minYM && compareYearMonth(ym, minYM) < 0) return true;
      if (maxYM && compareYearMonth(ym, maxYM) > 0) return true;
      return false;
    },
    [minYM, maxYM]
  );

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

  const prevYearDisabled = minYM ? viewYear <= minYM.year : false;
  const nextYearDisabled = maxYM ? viewYear >= maxYM.year : false;

  const prevYearPageDisabled = minYear != null && viewYearPageStart - 1 < minYear;
  const nextYearPageDisabled = maxYear != null && viewYearPageStart + YEARS_PER_PAGE > maxYear;

  const selectDay = (iso: string) => {
    if (isDisabled(iso, min, max)) return;
    onChange(iso);
    close();
  };

  const selectToday = () => {
    if (!isDisabled(today, min, max)) selectDay(today);
  };

  const selectMonth = (m: number) => {
    if (isMonthDisabled(viewYear, m)) return;
    setViewMonth(m);
    setPanelMode('day');
  };

  const isYearDisabled = useCallback(
    (y: number) => {
      if (minYear != null && y < minYear) return true;
      if (maxYear != null && y > maxYear) return true;
      return false;
    },
    [minYear, maxYear]
  );

  const selectYear = (y: number) => {
    if (isYearDisabled(y)) return;
    setViewYear(y);
    setPanelMode('month');
  };

  const openYearView = () => {
    setViewYearPageStart(yearPageStart(viewYear));
    setPanelMode('year');
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
        <span className="date-picker-field-value tabular-nums">{formatDisplayDate(value)}</span>
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
        aria-label="选择日期"
        widthMode="page"
      >
        {panelMode === 'year' ? (
          <>
            <div className="month-picker-header">
              <button
                type="button"
                className="month-picker-nav"
                onClick={() => setViewYearPageStart((s) => s - YEARS_PER_PAGE)}
                disabled={prevYearPageDisabled}
                aria-label="上一组年份"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="month-picker-title tabular-nums">
                {viewYearPageStart} – {viewYearPageStart + YEARS_PER_PAGE - 1}
              </span>
              <button
                type="button"
                className="month-picker-nav"
                onClick={() => setViewYearPageStart((s) => s + YEARS_PER_PAGE)}
                disabled={nextYearPageDisabled}
                aria-label="下一组年份"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="month-picker-grid">
              {yearPageYears.map((y) => {
                const disabled = isYearDisabled(y);
                const selected = parsed?.y === y;
                const isCurrent = y === new Date().getFullYear();
                return (
                  <button
                    key={y}
                    type="button"
                    className={[
                      'month-picker-month',
                      selected && 'month-picker-month-selected',
                      isCurrent && !selected && 'month-picker-month-current',
                      disabled && 'month-picker-month-disabled',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectYear(y)}
                    disabled={disabled}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </>
        ) : panelMode === 'month' ? (
          <>
            <div className="month-picker-header">
              <button
                type="button"
                className="month-picker-nav"
                onClick={() => setViewYear((y) => y - 1)}
                disabled={prevYearDisabled}
                aria-label="上一年"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="month-picker-title tabular-nums hover:text-accent transition-colors border-0 bg-transparent cursor-pointer p-0"
                onClick={openYearView}
              >
                {viewYear} 年
              </button>
              <button
                type="button"
                className="month-picker-nav"
                onClick={() => setViewYear((y) => y + 1)}
                disabled={nextYearDisabled}
                aria-label="下一年"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="month-picker-grid">
              {MONTHS.map((m) => {
                const disabled = isMonthDisabled(viewYear, m);
                const selected = parsed?.y === viewYear && parsed?.m === m;
                const isCurrent =
                  viewYear === new Date().getFullYear() && m === new Date().getMonth() + 1;
                return (
                  <button
                    key={m}
                    type="button"
                    className={[
                      'month-picker-month',
                      selected && 'month-picker-month-selected',
                      isCurrent && !selected && 'month-picker-month-current',
                      disabled && 'month-picker-month-disabled',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectMonth(m)}
                    disabled={disabled}
                  >
                    {m} 月
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
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
              <button
                type="button"
                className="date-picker-title tabular-nums hover:text-accent transition-colors"
                onClick={() => setPanelMode('month')}
              >
                {viewYear} 年 {viewMonth} 月
              </button>
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
          </>
        )}
      </FloatingPickerPortal>

      <input type="hidden" value={value} required={required} tabIndex={-1} readOnly aria-hidden />
    </div>
  );
}
