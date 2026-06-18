'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSettings } from '@/components/SettingsProvider';
import {
  exportLedgerCSV,
  fetchBackupFiles,
  importLedgerCSV,
  restoreFromBackup,
  type BackupFileInfo,
  type BackupFilesPage,
  type LedgerImportResult,
} from '@/lib/api';
import { toIntlLocale } from '@/lib/i18n/intlLocale';
import { formatApiError } from '@/lib/errors';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAt(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(toIntlLocale(locale), { hour12: false });
}

function BackupPickerDialog({
  open,
  loading,
  backupPage,
  locale,
  onRefresh,
  onSelect,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  backupPage: BackupFilesPage | null;
  locale: string;
  onRefresh: () => void;
  onSelect: (item: BackupFileInfo) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="confirm-overlay" role="presentation" onClick={onClose}>
      <div
        className="confirm-panel max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="backup-picker-title" className="confirm-title">
          {t('data.selectBackup')}
        </h2>
        {backupPage?.user_dir && (
          <p className="text-xs text-muted break-all mt-2">{t('common.directory', { path: backupPage.user_dir })}</p>
        )}
        <div className="mt-3 max-h-[min(50vh,320px)] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted py-4 text-center">{t('common.loading')}</p>
          ) : !backupPage?.dir_configured ? (
            <p className="text-sm text-muted py-2">
              {t('data.backupDirNotConfigured')}
              <Link href="/profile/backup/" className="text-accent mx-1 underline underline-offset-2">
                {t('profile.backup')}
              </Link>
              {t('data.backupDirNotConfiguredSuffix')}
            </p>
          ) : backupPage.items.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">{t('data.noBackups')}</p>
          ) : (
            <ul className="divide-y divide-line/60 rounded-2xl border border-line/80 overflow-hidden">
              {backupPage.items.map((item) => (
                <li key={item.filename}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent-soft/30 transition-colors"
                    onClick={() => onSelect(item)}
                  >
                    <div className="text-sm text-ink truncate">{item.filename}</div>
                    <div className="text-xs text-muted mt-0.5 tabular-nums">
                      {formatModifiedAt(item.modified_at, locale)} · {formatFileSize(item.size)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="confirm-actions mt-4">
          <button type="button" className="confirm-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-cancel"
            disabled={loading}
            onClick={onRefresh}
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DataContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [backupPage, setBackupPage] = useState<BackupFilesPage | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupPickerOpen, setBackupPickerOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<BackupFileInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  const formatImportSummary = useCallback(
    (r: LedgerImportResult): string => {
      const parts = [
        t('data.importSummaryTransactions', { count: r.imported_transactions }),
        t('data.importSummaryBalances', { count: r.imported_balances }),
      ];
      if (r.skipped_daily_expense > 0) {
        parts.push(t('data.importSummarySkippedDaily', { count: r.skipped_daily_expense }));
      }
      if (r.created_tags > 0) {
        parts.push(t('data.importSummaryCreatedTags', { count: r.created_tags }));
      }
      if (r.created_contacts > 0) {
        parts.push(t('data.importSummaryCreatedContacts', { count: r.created_contacts }));
      }
      return parts.join(i18n.language.startsWith('zh') ? '，' : ', ');
    },
    [t, i18n.language]
  );

  const loadBackupFiles = useCallback(async () => {
    setBackupLoading(true);
    try {
      const page = await fetchBackupFiles();
      setBackupPage(page);
      return page;
    } catch (err) {
      setError(formatApiError(err, t('data.loadBackupListFailed')));
      return null;
    } finally {
      setBackupLoading(false);
    }
  }, [t]);

  const openRestorePicker = async () => {
    setError('');
    setMsg('');
    setBackupPickerOpen(true);
    await loadBackupFiles();
  };

  const onExport = async () => {
    setError('');
    setMsg('');
    setExporting(true);
    try {
      await exportLedgerCSV();
    } catch (err) {
      setError(formatApiError(err, t('data.exportFailed')));
    } finally {
      setExporting(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setMsg('');
    setPendingFile(file);
  };

  const onConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setError('');
    setMsg('');
    try {
      const result = await importLedgerCSV(pendingFile);
      setMsg(t('data.importComplete', { summary: formatImportSummary(result) }));
    } catch (err) {
      setError(formatApiError(err, t('data.importFailed')));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const onSelectBackup = (item: BackupFileInfo) => {
    setBackupPickerOpen(false);
    setPendingRestore(item);
  };

  const onConfirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    setError('');
    setMsg('');
    try {
      const result = await restoreFromBackup(pendingRestore.filename);
      setMsg(t('data.restoreComplete', { summary: formatImportSummary(result) }));
    } catch (err) {
      setError(formatApiError(err, t('data.restoreFailed')));
    } finally {
      setRestoring(false);
      setPendingRestore(null);
    }
  };

  const restoreDisabled = importing || restoring || backupLoading;

  return (
    <div className="space-y-6">
      {msg && <p className="text-income text-sm">{msg}</p>}
      {error && <p className="text-expense text-sm">{error}</p>}

      <div className="notebook p-4 space-y-4">
        <div className="space-y-2 lg:hidden">
          <h2 className="font-medium text-sm text-ink">{t('data.exportTitle')}</h2>
          <p className="text-xs text-muted">{t('data.exportMobileHint')}</p>
        </div>

        <div className="hidden lg:block space-y-2">
          <h2 className="font-medium text-sm text-ink">{t('data.exportTitle')}</h2>
          <p className="text-xs text-muted">{t('data.exportDescription')}</p>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            {exporting ? t('data.exporting') : t('data.exportCsv')}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">{t('data.importTitle')}</h2>
          <p className="text-xs text-muted">{t('data.importDescription')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileChange}
          />
          <button
            type="button"
            className="btn-segment px-4"
            disabled={importing || restoring}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? t('data.importing') : t('data.selectCsv')}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">{t('data.restoreTitle')}</h2>
          <p className="text-xs text-muted">{t('data.restoreDescription')}</p>
          <button
            type="button"
            className="btn-segment px-4"
            disabled={restoreDisabled}
            onClick={() => void openRestorePicker()}
          >
            {restoring ? t('data.restoring') : t('data.restore')}
          </button>
        </div>
      </div>

      <BackupPickerDialog
        open={backupPickerOpen}
        loading={backupLoading}
        backupPage={backupPage}
        locale={locale}
        onRefresh={() => void loadBackupFiles()}
        onSelect={onSelectBackup}
        onClose={() => setBackupPickerOpen(false)}
      />

      <ConfirmDialog
        open={pendingFile !== null}
        title={t('data.confirmImportTitle')}
        message={t('data.confirmImportMessage', { filename: pendingFile?.name ?? '' })}
        confirmLabel={t('data.confirmImport')}
        confirming={importing}
        onConfirm={() => void onConfirmImport()}
        onClose={() => {
          if (!importing) setPendingFile(null);
        }}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        title={t('data.confirmRestoreTitle')}
        message={t('data.confirmRestoreMessage', { filename: pendingRestore?.filename ?? '' })}
        confirmLabel={t('data.confirmRestore')}
        confirming={restoring}
        onConfirm={() => void onConfirmRestore()}
        onClose={() => {
          if (!restoring) setPendingRestore(null);
        }}
      />
      <PageBackLink href="/profile/" />
    </div>
  );
}

export default function DataPage() {
  return (
    <RequireAuth>
      <DataContent />
    </RequireAuth>
  );
}
