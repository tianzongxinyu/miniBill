'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { AnnualReportView } from '@/components/annual/AnnualReportView';
import { FloatingPickerPortal } from '@/components/ui/FloatingPickerPortal';
import { LoadingFallback } from '@/components/ui/LoadingFallback';
import { EmptyNotebook } from '@/components/ui/EmptyNotebook';
import { YearMonthPickerPanel } from '@/components/ui/YearMonthPickerPanel';
import { useAnnualReport } from '@/hooks/useAnnualReport';
import { fetchAnnualDefaultYear } from '@/lib/api/stats';
import { useClickOutside } from '@/lib/combobox-utils';
import { formatApiError } from '@/lib/errors';
import { YEARS_PER_PAGE, yearPageStart } from '@/lib/pickerUtils';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function parseYearParam(yearParam: string | null): number | null {
  const n = yearParam ? Number(yearParam) : NaN;
  if (Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR) return n;
  return null;
}

function AnnualReportContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const yearParam = searchParams.get('year');
  const parsedYear = useMemo(() => parseYearParam(yearParam), [yearParam]);
  const [resolvingDefault, setResolvingDefault] = useState(parsedYear == null);
  const [defaultError, setDefaultError] = useState<unknown>(null);

  useEffect(() => {
    if (parsedYear != null) {
      setResolvingDefault(false);
      setDefaultError(null);
      return;
    }
    let cancelled = false;
    setResolvingDefault(true);
    setDefaultError(null);
    fetchAnnualDefaultYear()
      .then((y) => {
        if (cancelled) return;
        router.replace(`/stats/annual/?year=${y}`);
      })
      .catch((err) => {
        if (cancelled) return;
        setDefaultError(err);
        setResolvingDefault(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parsedYear, router]);

  const year = parsedYear;
  const { report, loading, error } = useAnnualReport(year);
  const waiting = year == null || resolvingDefault;

  const setYear = useCallback(
    (y: number) => {
      const next = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
      router.replace(`/stats/annual/?year=${next}`);
    },
    [router]
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewYearPageStart, setViewYearPageStart] = useState(() =>
    yearPageStart(year ?? new Date().getFullYear() - 1)
  );

  const close = useCallback(() => setOpen(false), []);
  useClickOutside([rootRef, floatingPanelRef], close);

  useEffect(() => {
    if (year != null && open) setViewYearPageStart(yearPageStart(year));
  }, [open, year]);

  const yearPageYears = useMemo(
    () => Array.from({ length: YEARS_PER_PAGE }, (_, i) => viewYearPageStart + i),
    [viewYearPageStart]
  );

  const isYearDisabled = useCallback(
    (y: number) => y < MIN_YEAR || y > MAX_YEAR,
    []
  );

  const prevYearPageDisabled = viewYearPageStart - 1 < MIN_YEAR;
  const nextYearPageDisabled = viewYearPageStart + YEARS_PER_PAGE > MAX_YEAR;

  const selectYear = (y: number) => {
    if (isYearDisabled(y)) return;
    setYear(y);
    close();
  };

  if (waiting) {
    if (defaultError != null) {
      return (
        <EmptyNotebook message={formatApiError(defaultError, t('common.loadFailed'))} />
      );
    }
    return <LoadingFallback />;
  }

  return (
    <div className="space-y-1 pb-8">
      <div ref={rootRef} className="annual-report-chrome">
        <div className="annual-report-year-group" role="group" aria-label={t('annualReport.title', { year })}>
          <button
            type="button"
            onClick={() => setYear(year - 1)}
            disabled={year <= MIN_YEAR}
            aria-label={t('annualReport.prevYear')}
          >
            ‹
          </button>
          <button
            ref={titleRef}
            type="button"
            className="annual-report-year-label"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            {t('annualReport.title', { year })}
          </button>
          <button
            type="button"
            onClick={() => setYear(year + 1)}
            disabled={year >= MAX_YEAR}
            aria-label={t('annualReport.nextYear')}
          >
            ›
          </button>
        </div>

        <FloatingPickerPortal
          open={open}
          anchorRef={titleRef}
          panelRef={floatingPanelRef}
          onClose={close}
          role="dialog"
          aria-label={t('common.selectYear')}
          widthMode="page"
        >
          <YearMonthPickerPanel
            panelMode="year"
            viewYear={year}
            viewYearPageStart={viewYearPageStart}
            value={{ year, month: 1 }}
            prevYearDisabled={year <= MIN_YEAR}
            nextYearDisabled={year >= MAX_YEAR}
            prevYearPageDisabled={prevYearPageDisabled}
            nextYearPageDisabled={nextYearPageDisabled}
            yearPageYears={yearPageYears}
            isDisabled={() => false}
            isYearDisabled={isYearDisabled}
            onPrevYearPage={() => setViewYearPageStart((s) => s - YEARS_PER_PAGE)}
            onNextYearPage={() => setViewYearPageStart((s) => s + YEARS_PER_PAGE)}
            onPrevYear={() => setYear(year - 1)}
            onNextYear={() => setYear(year + 1)}
            onOpenYearView={() => undefined}
            onSelectMonth={() => undefined}
            onSelectYear={selectYear}
            t={t}
          />
        </FloatingPickerPortal>
      </div>

      {loading && <LoadingFallback />}
      {!loading && error != null ? (
        <EmptyNotebook message={formatApiError(error, t('common.loadFailed'))} />
      ) : null}
      {!loading && error == null && report ? <AnnualReportView report={report} /> : null}
    </div>
  );
}

export default function AnnualReportPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingFallback />}>
        <AnnualReportContent />
      </Suspense>
    </RequireAuth>
  );
}
