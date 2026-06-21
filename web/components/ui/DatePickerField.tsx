'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareYearMonth, type YearMonth } from '@/lib/api';
import { parseISODate, toISODate } from '@/lib/formatDate';
import { useFormatDate } from '@/hooks/useFormatDate';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';
import { YearMonthPickerPanel } from '@/components/ui/YearMonthPickerPanel';
import { YEARS_PER_PAGE, yearPageStart } from '@/lib/pickerUtils';

const WEEKDAY_KEYS = [
  'picker.weekdayMon',
  'picker.weekdayTue',
  'picker.weekdayWed',
  'picker.weekdayThu',
  'picker.weekdayFri',
  'picker.weekdaySat',
  'picker.weekdaySun',
] as const;

function todayISO(): string {
  const t = new Date();
  return toISODate(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function monthRange(y: number, m: number): { first: string; last: string } {
  return { first: toISODate(y, m, 1), last: toISODate(y, m, daysInMonth(y, m)) };
}

function yearMonthFromISO(iso?: string): YearMonth | null {
  if (!iso) return null;
  const p = parseISODate(iso);
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
    cells.push({ iso: toISODate(prevYear, prevMonth, day), day, inMonth: false });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ iso: toISODate(viewYear, viewMonth, day), day, inMonth: true });
  }
  const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
  const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ iso: toISODate(nextYear, nextMonth, nextDay), day: nextDay, inMonth: false });
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
  const { t } = useTranslation();
  const { formatISODate, formatYearMonth } = useFormatDate();
  const weekdayLabels = useMemo(() => WEEKDAY_KEYS.map((key) => t(key)), [t]);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'day' | 'month' | 'year'>('day');

  const parsed = parseISODate(value);
  const fallback = parseISODate(todayISO())!;
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

  const pickerValue: YearMonth = {
    year: parsed?.y ?? viewYear,
    month: parsed?.m ?? viewMonth,
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
          {value ? formatISODate(value) : t('common.selectDate')}
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
        aria-label={t('common.selectDate')}
        widthMode="page"
      >
        {panelMode === 'year' || panelMode === 'month' ? (
          <YearMonthPickerPanel
            panelMode={panelMode}
            viewYear={viewYear}
            viewYearPageStart={viewYearPageStart}
            value={pickerValue}
            prevYearDisabled={prevYearDisabled}
            nextYearDisabled={nextYearDisabled}
            prevYearPageDisabled={prevYearPageDisabled}
            nextYearPageDisabled={nextYearPageDisabled}
            yearPageYears={yearPageYears}
            isDisabled={isMonthDisabled}
            isYearDisabled={isYearDisabled}
            onPrevYearPage={() => setViewYearPageStart((s) => s - YEARS_PER_PAGE)}
            onNextYearPage={() => setViewYearPageStart((s) => s + YEARS_PER_PAGE)}
            onPrevYear={() => setViewYear((y) => y - 1)}
            onNextYear={() => setViewYear((y) => y + 1)}
            onOpenYearView={openYearView}
            onSelectMonth={selectMonth}
            onSelectYear={selectYear}
            t={t}
          />
        ) : (
          <>
            <div className="date-picker-header">
              <button
                type="button"
                className="date-picker-nav"
                onClick={prevMonth}
                disabled={prevDisabled}
                aria-label={t('picker.prevMonth')}
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
                {formatYearMonth({ year: viewYear, month: viewMonth })}
              </button>
              <button
                type="button"
                className="date-picker-nav"
                onClick={nextMonthNav}
                disabled={nextDisabled}
                aria-label={t('picker.nextMonth')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="date-picker-weekdays">
              {weekdayLabels.map((w) => (
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
                {t('common.today')}
              </button>
            </div>
          </>
        )}
      </FloatingPickerPortal>

      <input type="hidden" value={value} required={required} tabIndex={-1} readOnly aria-hidden />
    </div>
  );
}
