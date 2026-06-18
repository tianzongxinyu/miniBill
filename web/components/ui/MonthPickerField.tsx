'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';
import { compareYearMonth, type YearMonth } from '@/lib/api';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const YEARS_PER_PAGE = 12;

function yearPageStart(y: number): number {
  return Math.floor((y - 1) / YEARS_PER_PAGE) * YEARS_PER_PAGE + 1;
}

function formatDisplay({ year, month }: YearMonth, t: (key: string, opts?: Record<string, unknown>) => string): string {
  return t('common.yearMonth', { year, month });
}

type MonthPickerFieldProps = {
  value: YearMonth;
  onChange: (value: YearMonth) => void;
  min?: YearMonth | null;
  max?: YearMonth | null;
  disabled?: boolean;
  /** compact：工具栏内联；field：表单全宽、值右对齐 */
  variant?: 'compact' | 'field';
};

type MonthPickerPanelProps = {
  panelMode: 'month' | 'year';
  viewYear: number;
  viewYearPageStart: number;
  value: YearMonth;
  prevYearDisabled: boolean;
  nextYearDisabled: boolean;
  prevYearPageDisabled: boolean;
  nextYearPageDisabled: boolean;
  yearPageYears: number[];
  isDisabled: (y: number, m: number) => boolean;
  isYearDisabled: (y: number) => boolean;
  onPrevYearPage: () => void;
  onNextYearPage: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
  onOpenYearView: () => void;
  onSelectMonth: (m: number) => void;
  onSelectYear: (y: number) => void;
};

function MonthPickerPanel({
  panelMode,
  viewYear,
  viewYearPageStart,
  value,
  prevYearDisabled,
  nextYearDisabled,
  prevYearPageDisabled,
  nextYearPageDisabled,
  yearPageYears,
  isDisabled,
  isYearDisabled,
  onPrevYearPage,
  onNextYearPage,
  onPrevYear,
  onNextYear,
  onOpenYearView,
  onSelectMonth,
  onSelectYear,
  t,
}: MonthPickerPanelProps & { t: (key: string, opts?: Record<string, unknown>) => string }) {
  if (panelMode === 'year') {
    return (
      <>
        <div className="month-picker-header">
          <button
            type="button"
            className="month-picker-nav"
            onClick={onPrevYearPage}
            disabled={prevYearPageDisabled}
            aria-label={t('picker.prevYearGroup')}
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
            onClick={onNextYearPage}
            disabled={nextYearPageDisabled}
            aria-label={t('picker.nextYearGroup')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="month-picker-grid">
          {yearPageYears.map((y) => {
            const yearDisabled = isYearDisabled(y);
            const selected = value.year === y;
            const isCurrent = y === new Date().getFullYear();
            return (
              <button
                key={y}
                type="button"
                className={[
                  'month-picker-month',
                  selected && 'month-picker-month-selected',
                  isCurrent && !selected && 'month-picker-month-current',
                  yearDisabled && 'month-picker-month-disabled',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectYear(y)}
                disabled={yearDisabled}
              >
                {y}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="month-picker-header">
        <button
          type="button"
          className="month-picker-nav"
          onClick={onPrevYear}
          disabled={prevYearDisabled}
          aria-label={t('picker.prevYear')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="month-picker-title tabular-nums hover:text-accent transition-colors border-0 bg-transparent cursor-pointer p-0"
          onClick={onOpenYearView}
        >
          {t('common.yearOnly', { year: viewYear })}
        </button>
        <button
          type="button"
          className="month-picker-nav"
          onClick={onNextYear}
          disabled={nextYearDisabled}
          aria-label={t('picker.nextYear')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="month-picker-grid">
        {MONTHS.map((m) => {
          const monthDisabled = isDisabled(viewYear, m);
          const selected = value.year === viewYear && value.month === m;
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
                monthDisabled && 'month-picker-month-disabled',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectMonth(m)}
              disabled={monthDisabled}
            >
              {t('common.monthOnly', { month: m })}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function MonthPickerField({
  value,
  onChange,
  min,
  max,
  disabled,
  variant = 'compact',
}: MonthPickerFieldProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'month' | 'year'>('month');
  const [viewYear, setViewYear] = useState(value.year);
  const [viewYearPageStart, setViewYearPageStart] = useState(() => yearPageStart(value.year));

  const minYear = min?.year ?? null;
  const maxYear = max?.year ?? null;

  const close = useCallback(() => {
    setOpen(false);
    setPanelMode('month');
  }, []);

  useClickOutside([rootRef, floatingPanelRef], close);

  useEffect(() => {
    if (open) {
      setViewYear(value.year);
      setViewYearPageStart(yearPageStart(value.year));
      setPanelMode('month');
    }
  }, [open, value.year]);

  const yearPageYears = useMemo(
    () => Array.from({ length: YEARS_PER_PAGE }, (_, i) => viewYearPageStart + i),
    [viewYearPageStart]
  );

  const isDisabled = (y: number, m: number) => {
    const ym = { year: y, month: m };
    if (min && compareYearMonth(ym, min) < 0) return true;
    if (max && compareYearMonth(ym, max) > 0) return true;
    return false;
  };

  const isYearDisabled = useCallback(
    (y: number) => {
      if (minYear != null && y < minYear) return true;
      if (maxYear != null && y > maxYear) return true;
      return false;
    },
    [minYear, maxYear]
  );

  const prevYearDisabled = min ? viewYear <= min.year : false;
  const nextYearDisabled = max ? viewYear >= max.year : false;
  const prevYearPageDisabled = minYear != null && viewYearPageStart - 1 < minYear;
  const nextYearPageDisabled = maxYear != null && viewYearPageStart + YEARS_PER_PAGE > maxYear;

  const selectMonth = (m: number) => {
    if (disabled || isDisabled(viewYear, m)) return;
    onChange({ year: viewYear, month: m });
    close();
  };

  const selectYear = (y: number) => {
    if (isYearDisabled(y)) return;
    setViewYear(y);
    setPanelMode('month');
  };

  const openYearView = () => {
    setViewYearPageStart(yearPageStart(viewYear));
    setPanelMode('year');
  };

  const panelProps: MonthPickerPanelProps = {
    panelMode,
    viewYear,
    viewYearPageStart,
    value,
    prevYearDisabled,
    nextYearDisabled,
    prevYearPageDisabled,
    nextYearPageDisabled,
    yearPageYears,
    isDisabled,
    isYearDisabled,
    onPrevYearPage: () => setViewYearPageStart((s) => s - YEARS_PER_PAGE),
    onNextYearPage: () => setViewYearPageStart((s) => s + YEARS_PER_PAGE),
    onPrevYear: () => setViewYear((y) => y - 1),
    onNextYear: () => setViewYear((y) => y + 1),
    onOpenYearView: openYearView,
    onSelectMonth: selectMonth,
    onSelectYear: selectYear,
  };

  return (
    <div
      ref={rootRef}
      className={[
        'month-picker',
        variant === 'field' && 'month-picker-field-width',
        disabled && 'month-picker-disabled',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={fieldRef}
        type="button"
        className={[
          'month-picker-field',
          variant === 'field' && 'month-picker-field-block',
          open && 'month-picker-field-open',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
      >
        <span className="month-picker-field-value tabular-nums">{formatDisplay(value, t)}</span>
        <span className={`month-picker-field-chevron${open ? ' month-picker-field-chevron-open' : ''}`} aria-hidden>
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
        aria-label={t('common.selectMonth')}
        widthMode="page"
      >
        <MonthPickerPanel {...panelProps} t={t} />
      </FloatingPickerPortal>
    </div>
  );
}
