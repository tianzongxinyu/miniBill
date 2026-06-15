'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useClickOutside } from '@/lib/combobox-utils';
import { compareYearMonth, type YearMonth } from '@/lib/api';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function formatDisplay({ year, month }: YearMonth): string {
  return `${year} 年 ${month} 月`;
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

export function MonthPickerField({
  value,
  onChange,
  min,
  max,
  disabled,
  variant = 'compact',
}: MonthPickerFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.year);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close);

  useEffect(() => {
    if (open) setViewYear(value.year);
  }, [open, value.year]);

  const isDisabled = (y: number, m: number) => {
    const ym = { year: y, month: m };
    if (min && compareYearMonth(ym, min) < 0) return true;
    if (max && compareYearMonth(ym, max) > 0) return true;
    return false;
  };

  const prevYearDisabled = min ? viewYear <= min.year : false;
  const nextYearDisabled = max ? viewYear >= max.year : false;

  const selectMonth = (m: number) => {
    if (disabled || isDisabled(viewYear, m)) return;
    onChange({ year: viewYear, month: m });
    setOpen(false);
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
        <span className="month-picker-field-value tabular-nums">{formatDisplay(value)}</span>
        <span className={`month-picker-field-chevron${open ? ' month-picker-field-chevron-open' : ''}`} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="month-picker-panel" role="dialog" aria-label="选择月份">
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
            <span className="month-picker-title tabular-nums">{viewYear} 年</span>
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
              const disabled = isDisabled(viewYear, m);
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
        </div>
      )}
    </div>
  );
}
