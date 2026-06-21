'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '@/lib/combobox-utils';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';
import { YearMonthPickerPanel } from '@/components/ui/YearMonthPickerPanel';
import { compareYearMonth, type YearMonth } from '@/lib/api';
import { useFormatDate } from '@/hooks/useFormatDate';
import { YEARS_PER_PAGE, yearPageStart } from '@/lib/pickerUtils';

type MonthPickerFieldProps = {
  value: YearMonth;
  onChange: (value: YearMonth) => void;
  min?: YearMonth | null;
  max?: YearMonth | null;
  disabled?: boolean;
  /** compact：工具栏内联；field：表单全宽、值右对齐 */
  variant?: 'compact' | 'field';
};

export function MonthPickerField({
  value,
  onChange,
  min,
  max,
  disabled,
  variant = 'compact',
}: MonthPickerFieldProps) {
  const { t } = useTranslation();
  const { formatYearMonth } = useFormatDate();
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
        <span className="month-picker-field-value tabular-nums">{formatYearMonth(value)}</span>
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
        <YearMonthPickerPanel
          panelMode={panelMode}
          viewYear={viewYear}
          viewYearPageStart={viewYearPageStart}
          value={value}
          prevYearDisabled={prevYearDisabled}
          nextYearDisabled={nextYearDisabled}
          prevYearPageDisabled={prevYearPageDisabled}
          nextYearPageDisabled={nextYearPageDisabled}
          yearPageYears={yearPageYears}
          isDisabled={isDisabled}
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
      </FloatingPickerPortal>
    </div>
  );
}
