import type { YearMonth } from '@/lib/api';
import { YEARS_PER_PAGE } from '@/lib/pickerUtils';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export type YearMonthPickerPanelProps = {
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
  t: (key: string, opts?: Record<string, unknown>) => string;
};

export function YearMonthPickerPanel({
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
}: YearMonthPickerPanelProps) {
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
