'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MonthPickerField } from '@/components/ui/MonthPickerField';
import {
  ApiError,
  centsToYuan,
  fetchMonthlyBalance,
  upsertMonthlyBalance,
  type YearMonth,
} from '@/lib/api';
import { formatBalanceMonthLabel } from '@/lib/balanceMonth';
import { formatApiError } from '@/lib/errors';
import { formatBalanceMoney } from '@/lib/formatMoney';
import { notifyBalanceMonths } from '@/lib/ledgerEvents';

function sameMonth(a: YearMonth, b: YearMonth) {
  return a.year === b.year && a.month === b.month;
}

type BalanceRegisterFormProps = {
  initialTarget: YearMonth;
  minMonth: YearMonth | null;
  maxMonth: YearMonth;
  returnTo: string;
  onInitialLoaded?: (info: { isEdit: boolean }) => void;
};

export function BalanceRegisterForm({
  initialTarget,
  minMonth,
  maxMonth,
  returnTo,
  onInitialLoaded,
}: BalanceRegisterFormProps) {
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
          setBalance(centsToYuan(record.balance));
          setNote(record.note ?? '');
          setHasExisting(true);
          setExistingBalanceCents(record.balance);
          if (isInitial) {
            setIsEdit(true);
            onInitialLoaded?.({ isEdit: true });
          }
        } else {
          setBalance('');
          setNote('');
          setHasExisting(false);
          setExistingBalanceCents(null);
          if (isInitial) {
            setIsEdit(false);
            onInitialLoaded?.({ isEdit: false });
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ABORTED') return;
        setError(formatApiError(err, '加载失败'));
      } finally {
        setLoadingMonth(false);
        if (isInitial) setInitialLoaded(true);
      }
    },
    [onInitialLoaded]
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
      setError(formatApiError(err, '保存失败'));
      setSaving(false);
      setConfirmOpen(false);
    }
  }, [balance, note, returnTo, router, selectedMonth]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (needsOverwriteHint) {
      setConfirmOpen(true);
      return;
    }
    void persist();
  };

  if (!initialLoaded) {
    return <div className="notebook p-8 text-center text-sm text-muted">加载中…</div>;
  }

  const overwriteMessage =
    existingBalanceCents != null
      ? `${formatBalanceMonthLabel(selectedMonth)}已有余额登记（${formatBalanceMoney(existingBalanceCents)}），确认覆盖？`
      : `${formatBalanceMonthLabel(selectedMonth)}已有余额登记，确认覆盖？`;

  return (
    <>
      <form onSubmit={save} className="notebook p-4 space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">登记月份</label>
          <MonthPickerField
            value={selectedMonth}
            onChange={handleMonthChange}
            min={minMonth}
            max={maxMonth}
            disabled={loadingMonth || saving || isEdit}
            variant="field"
          />
          {loadingMonth && <p className="text-xs text-muted mt-1.5">加载中…</p>}
          {needsOverwriteHint && !loadingMonth && (
            <p className="text-xs text-muted mt-1.5">该月已有登记，保存将覆盖现有余额</p>
          )}
        </div>

        <div>
          <label htmlFor="balance-amount" className="block text-xs text-muted mb-1.5">
            余额（元）
          </label>
          <input
            id="balance-amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="field-amount"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
            disabled={loadingMonth || saving}
          />
        </div>

        <div>
          <label htmlFor="balance-note" className="block text-xs text-muted mb-1.5">
            备注
          </label>
          <input
            id="balance-note"
            placeholder="可选"
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loadingMonth || saving}
          />
        </div>

        {error && <p className="text-expense text-sm">{error}</p>}

        <button
          type="submit"
          className="btn-primary-block"
          disabled={saving || loadingMonth}
        >
          {saving ? '保存中…' : isEdit ? '保存修改' : '保存登记'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="覆盖已有登记"
        message={overwriteMessage}
        confirmLabel="确认覆盖"
        confirming={saving}
        onConfirm={() => void persist()}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />
    </>
  );
}
