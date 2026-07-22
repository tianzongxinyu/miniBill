'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CsvColumnMapping, CsvImportField, CsvImportPreview } from '@/lib/csvImportPreview';
import { mappingReady } from '@/lib/csvImportPreview';

const FIELDS: CsvImportField[] = ['date', 'flow', 'amount', 'tags', 'contact', 'note', 'balance'];

export type CsvImportConfirmOpts = {
  mapping: CsvColumnMapping;
  keepHistory: boolean;
  deriveBalances: boolean;
  openingBalance: string;
};

type Props = {
  open: boolean;
  filename: string;
  preview: CsvImportPreview | null;
  confirming?: boolean;
  onConfirm: (opts: CsvImportConfirmOpts) => void;
  onClose: () => void;
};

export function CsvImportMappingDialog({
  open,
  filename,
  preview,
  confirming = false,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [keepHistory, setKeepHistory] = useState(true);
  const [deriveBalances, setDeriveBalances] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !preview) return;
    setMapping({ ...preview.mapping });
    setKeepHistory(true);
    setDeriveBalances(false);
    setOpeningBalance('');
  }, [open, preview]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, confirming, onClose]);

  if (!mounted || !open || !preview) return null;

  const hasRunningBalance = Boolean(mapping.balance);
  const openingOk =
    !deriveBalances || hasRunningBalance || openingBalance.trim() !== '';
  const canSubmit = mappingReady(mapping) && openingOk && !confirming;

  const setField = (field: CsvImportField, value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[field];
      } else {
        for (const f of FIELDS) {
          if (f !== field && next[f] === value) delete next[f];
        }
        next[field] = value;
      }
      return next;
    });
  };

  return createPortal(
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={() => {
        if (!confirming) onClose();
      }}
    >
      <div
        className="confirm-panel max-w-lg w-full max-h-[min(90vh,640px)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-map-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="csv-import-map-title" className="confirm-title">
          {t('data.csvMapTitle')}
        </h2>
        <p className="confirm-message text-sm">
          {t('data.csvMapSubtitle', { filename })}
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-line/80">
          <table className="w-full text-xs text-left">
            <thead className="bg-black/[0.03]">
              <tr>
                {preview.headers.map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium text-ink whitespace-nowrap">
                    {h || '—'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, ri) => (
                <tr key={ri} className="border-t border-line/60">
                  {preview.headers.map((_, ci) => (
                    <td key={ci} className="px-2 py-1 text-muted whitespace-nowrap max-w-[9rem] truncate">
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-ink">{t('data.csvMapFields')}</p>
          {FIELDS.map((field) => {
            const required = field === 'date' || field === 'flow' || field === 'amount';
            return (
              <label key={field} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted">
                  {t(`data.csvField.${field}`)}
                  {required ? ' *' : ''}
                </span>
                <select
                  className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-ink"
                  value={mapping[field] ?? ''}
                  disabled={confirming}
                  onChange={(e) => setField(field, e.target.value)}
                >
                  <option value="">{t('data.csvFieldIgnore')}</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h || t('data.csvEmptyHeader')}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={keepHistory}
            disabled={confirming}
            onChange={(e) => setKeepHistory(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t('data.csvKeepHistory')}</span>
            <span className="block text-xs text-muted mt-0.5">{t('data.csvKeepHistoryHint')}</span>
          </span>
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={deriveBalances}
            disabled={confirming}
            onChange={(e) => setDeriveBalances(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t('data.csvDeriveBalances')}</span>
            <span className="block text-xs text-muted mt-0.5">{t('data.csvDeriveBalancesHint')}</span>
          </span>
        </label>

        {deriveBalances && hasRunningBalance && (
          <p className="mt-2 text-xs text-muted">{t('data.csvDeriveFromRunning')}</p>
        )}

        {deriveBalances && !hasRunningBalance && (
          <label className="mt-3 block space-y-1">
            <span className="text-sm text-muted">{t('data.csvOpeningBalance')} *</span>
            <input
              type="text"
              inputMode="decimal"
              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
              value={openingBalance}
              disabled={confirming}
              placeholder="0"
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <span className="block text-xs text-muted">{t('data.csvOpeningBalanceHint')}</span>
          </label>
        )}

        {!mappingReady(mapping) && (
          <p className="mt-2 text-xs text-expense">{t('data.csvMapRequired')}</p>
        )}
        {deriveBalances && !hasRunningBalance && !openingBalance.trim() && (
          <p className="mt-2 text-xs text-expense">{t('data.csvOpeningRequired')}</p>
        )}

        <div className="confirm-actions mt-4">
          <button type="button" className="confirm-cancel" onClick={onClose} disabled={confirming}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-confirm"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                mapping,
                keepHistory,
                deriveBalances,
                openingBalance: openingBalance.trim(),
              })
            }
          >
            {confirming ? t('common.processing') : t('data.confirmImport')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
