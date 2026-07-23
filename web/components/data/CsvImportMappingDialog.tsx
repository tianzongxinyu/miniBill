'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CsvColumnMapping, CsvImportField, CsvImportPreview } from '@/lib/csvImportPreview';
import { mappingReady } from '@/lib/csvImportPreview';
import { SimpleSelect } from '@/components/ui/SimpleSelect';

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

  const columnOptions = useMemo(() => {
    if (!preview) return [];
    return [
      { value: '', label: t('data.csvFieldIgnore') },
      ...preview.headers.map((h) => ({
        value: h,
        label: h || t('data.csvEmptyHeader'),
      })),
    ];
  }, [preview, t]);

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
        className="confirm-panel csv-import-panel max-w-lg w-full max-h-[min(90vh,640px)] overflow-y-auto"
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

        <div className="csv-import-preview mt-4 overflow-x-auto rounded-2xl border border-line/80">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-accent-soft/50">
                {preview.headers.map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="px-3 py-2 font-medium text-ink whitespace-nowrap"
                  >
                    {h || '—'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`border-t border-line/50 ${ri % 2 === 1 ? 'bg-black/[0.02]' : ''}`}
                >
                  {preview.headers.map((_, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-1.5 text-muted whitespace-nowrap max-w-[9rem] truncate"
                    >
                      {row[ci] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-ink tracking-tight">{t('data.csvMapFields')}</p>
          <div className="mt-3 rounded-2xl border border-line/80 divide-y divide-line/60 overflow-hidden">
            {FIELDS.map((field) => {
              const required = field === 'date' || field === 'flow' || field === 'amount';
              const label = t(`data.csvField.${field}`);
              return (
                <div
                  key={field}
                  className="flex items-center gap-3 px-3 py-2.5 bg-surface"
                >
                  <span className="w-24 shrink-0 text-sm text-muted">
                    {label}
                    {required ? <span className="text-accent ml-0.5">*</span> : null}
                  </span>
                  <SimpleSelect
                    className="flex-1"
                    value={mapping[field] ?? ''}
                    options={columnOptions}
                    disabled={confirming}
                    ariaLabel={label}
                    onChange={(v) => setField(field, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <label className="csv-import-option flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--color-accent)]"
              checked={keepHistory}
              disabled={confirming}
              onChange={(e) => setKeepHistory(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-ink">{t('data.csvKeepHistory')}</span>
              <span className="block text-xs text-muted mt-0.5 leading-relaxed">
                {t('data.csvKeepHistoryHint')}
              </span>
            </span>
          </label>

          <label className="csv-import-option flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--color-accent)]"
              checked={deriveBalances}
              disabled={confirming}
              onChange={(e) => setDeriveBalances(e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-ink">{t('data.csvDeriveBalances')}</span>
              <span className="block text-xs text-muted mt-0.5 leading-relaxed">
                {t('data.csvDeriveBalancesHint')}
              </span>
            </span>
          </label>
        </div>

        {deriveBalances && hasRunningBalance && (
          <p className="mt-2.5 text-xs text-muted">{t('data.csvDeriveFromRunning')}</p>
        )}

        {deriveBalances && !hasRunningBalance && (
          <label className="mt-3 block space-y-1.5">
            <span className="text-sm text-muted">
              {t('data.csvOpeningBalance')}
              <span className="text-accent ml-0.5">*</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              className="field"
              value={openingBalance}
              disabled={confirming}
              placeholder="0"
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <span className="block text-xs text-muted">{t('data.csvOpeningBalanceHint')}</span>
          </label>
        )}

        {!mappingReady(mapping) && (
          <p className="mt-2.5 text-xs text-expense">{t('data.csvMapRequired')}</p>
        )}
        {deriveBalances && !hasRunningBalance && !openingBalance.trim() && (
          <p className="mt-2.5 text-xs text-expense">{t('data.csvOpeningRequired')}</p>
        )}

        <div className="confirm-actions mt-5">
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
