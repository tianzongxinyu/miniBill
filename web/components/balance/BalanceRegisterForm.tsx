'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PageBackLink, PageFooterActions } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MonthPickerField } from '@/components/ui/MonthPickerField';
import { useSettings } from '@/components/SettingsProvider';
import {
  ApiError,
  centsToYuanInput,
  fetchMonthlyBalance,
  upsertMonthlyBalance,
  type YearMonth,
} from '@/lib/api';
import { useFormatDate } from '@/hooks/useFormatDate';
import { formatApiError } from '@/lib/errors';
import { formatBalanceMoney } from '@/lib/formatMoney';
import { notifyBalanceMonths } from '@/lib/ledgerEvents';

function sameMonth(a: YearMonth, b: YearMonth) {
  return a.year === b.year && a.month === b.month;
}

type BalanceRegisterFormProps = {
  backHref: string;
  initialTarget: YearMonth;
  minMonth: YearMonth | null;
  maxMonth: YearMonth;
  returnTo: string;
};

export function BalanceRegisterForm({
  backHref,
  initialTarget,
  minMonth,
  maxMonth,
  returnTo,
}: BalanceRegisterFormProps) {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const { formatYearMonth } = useFormatDate();
  const router = useRouter();
  const initialTargetRef = useRef(initialTarget);
  const [selectedMonth, setSelectedMonth] = useState(initialTarget);
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [existingBalanceCents, setExistingBalanceCents] = useState<number | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const monthChanged = !sameMonth(selectedMonth, initialTargetRef.current);
  const needsOverwriteHint = hasExisting && monthChanged;

  const loadMonth = useCallback(
    async (ym: YearMonth, isInitial: boolean) => {
      setLoadingMonth(true);
      if (isInitial) setError('');

      try {
        const record = await fetchMonthlyBalance(ym.year, ym.month);
        if (record) {
          setBalance(centsToYuanInput(record.balance));
          setNote(record.note ?? '');
          setHasExisting(true);
          setExistingBalanceCents(record.balance);
          if (isInitial) {
            setIsEdit(true);
          }
        } else {
          setBalance('');
          setNote('');
          setHasExisting(false);
          setExistingBalanceCents(null);
          if (isInitial) {
            setIsEdit(false);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ABORTED') return;
        setError(formatApiError(err, t('common.loadFailed')));
      } finally {
        setLoadingMonth(false);
        if (isInitial) setInitialLoaded(true);
      }
    },
    [t]
  );

  useEffect(() => {
    initialTargetRef.current = initialTarget;
    setSelectedMonth(initialTarget);
    setInitialLoaded(false);
    void loadMonth(initialTarget, true);
  }, [initialTarget, loadMonth]);

  const handleMonthChange = (ym: YearMonth) => {
    setSelectedMonth(ym);
    void loadMonth(ym, false);
  };

  const persist = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await upsertMonthlyBalance(selectedMonth.year, selectedMonth.month, balance, note);
      notifyBalanceMonths(selectedMonth.year, selectedMonth.month);
      router.replace(returnTo);
    } catch (err) {
      setError(formatApiError(err, t('common.saveFailed')));
      setSaving(false);
      setConfirmOpen(false);
    }
  }, [balance, note, returnTo, router, selectedMonth, t]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsOverwriteHint) {
      setConfirmOpen(true);
      return;
    }
    void persist();
  };

  if (!initialLoaded) {
    return (
      <div className="add-form">
        <h1 className="form-page-title">
          {t('balance.registerTitle')}
        </h1>
        <p className="text-muted text-sm">{t('common.loading')}</p>
        <PageBackLink href={backHref} />
      </div>
    );
  }

  const monthLabel = formatYearMonth(selectedMonth);
  const overwriteMessage =
    existingBalanceCents != null
      ? t('balance.overwriteWithAmount', {
          month: monthLabel,
          amount: formatBalanceMoney(existingBalanceCents, locale),
        })
      : t('balance.overwriteWithoutAmount', { month: monthLabel });

  return (
    <>
      <form onSubmit={save} className="add-form">
        <h1 className="form-page-title">
          {t('balance.registerTitle')}
        </h1>

        {error && <p className="form-alert-error">{error}</p>}

        <div className="form-hero">
          <div className="form-hero-amount">
            <input
              id="balance-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="form-amount-input text-ink"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
              disabled={loadingMonth || saving}
            />
          </div>
        </div>

        <div className="form-details form-section-delay-1">
          <div className="form-row">
            <div className="form-label">{t('balance.month')}</div>
            <MonthPickerField
              value={selectedMonth}
              onChange={handleMonthChange}
              min={minMonth}
              max={maxMonth}
              disabled={loadingMonth || saving || isEdit}
              variant="field"
            />
          </div>

          <div className="form-row form-row-start">
            <div className="form-label">{t('balance.note')}</div>
            <textarea
              id="balance-note"
              className="form-note-field"
              rows={2}
              placeholder={t('common.optional')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loadingMonth || saving}
            />
          </div>
        </div>

        {loadingMonth && <p className="text-xs text-muted px-1">{t('common.loading')}</p>}
        {needsOverwriteHint && !loadingMonth && (
          <p className="text-xs text-muted px-1">{t('balance.overwriteHint')}</p>
        )}

        <PageFooterActions>
          <button type="submit" className="form-submit" disabled={saving || loadingMonth}>
            {saving ? t('balance.saving') : isEdit ? t('balance.saveChanges') : t('balance.saveRegister')}
          </button>
          <PageBackLink href={backHref} />
        </PageFooterActions>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={t('balance.overwriteTitle')}
        message={overwriteMessage}
        confirmLabel={t('balance.confirmOverwrite')}
        confirming={saving}
        onConfirm={() => void persist()}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />
    </>
  );
}
