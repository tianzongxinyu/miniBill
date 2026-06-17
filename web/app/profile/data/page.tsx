'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  exportLedgerCSV,
  fetchBackupFiles,
  importLedgerCSV,
  restoreFromBackup,
  type BackupFileInfo,
  type BackupFilesPage,
  type LedgerImportResult,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function formatImportSummary(r: LedgerImportResult): string {
  const parts = [
    `流水 ${r.imported_transactions} 条`,
    `月度余额 ${r.imported_balances} 条`,
  ];
  if (r.skipped_daily_expense > 0) {
    parts.push(`跳过日常支出 ${r.skipped_daily_expense} 条`);
  }
  if (r.created_tags > 0) {
    parts.push(`新建标签 ${r.created_tags} 个`);
  }
  if (r.created_contacts > 0) {
    parts.push(`新建联系人 ${r.created_contacts} 个`);
  }
  return parts.join('，');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function BackupPickerDialog({
  open,
  loading,
  backupPage,
  onRefresh,
  onSelect,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  backupPage: BackupFilesPage | null;
  onRefresh: () => void;
  onSelect: (item: BackupFileInfo) => void;
  onClose: () => void;
}) {
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
          选择备份文件
        </h2>
        {backupPage?.user_dir && (
          <p className="text-xs text-muted break-all mt-2">目录：{backupPage.user_dir}</p>
        )}
        <div className="mt-3 max-h-[min(50vh,320px)] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted py-4 text-center">加载中…</p>
          ) : !backupPage?.dir_configured ? (
            <p className="text-sm text-muted py-2">
              备份目录未配置，请先在
              <Link href="/profile/backup/" className="text-accent mx-1 underline underline-offset-2">
                备份管理
              </Link>
              中完成目录授权。
            </p>
          ) : backupPage.items.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">暂无备份文件</p>
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
                      {formatModifiedAt(item.modified_at)} · {formatFileSize(item.size)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="confirm-actions mt-4">
          <button type="button" className="confirm-cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="confirm-cancel"
            disabled={loading}
            onClick={onRefresh}
          >
            刷新
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DataContent() {
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

  const loadBackupFiles = useCallback(async () => {
    setBackupLoading(true);
    try {
      const page = await fetchBackupFiles();
      setBackupPage(page);
      return page;
    } catch (err) {
      setError(formatApiError(err, '加载备份列表失败'));
      return null;
    } finally {
      setBackupLoading(false);
    }
  }, []);

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
      const { message } = await exportLedgerCSV();
      setMsg(message);
    } catch (err) {
      setError(formatApiError(err, '导出失败'));
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
      setMsg(`导入完成：${formatImportSummary(result)}`);
    } catch (err) {
      setError(formatApiError(err, '导入失败'));
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
      setMsg(`已从备份恢复：${formatImportSummary(result)}`);
    } catch (err) {
      setError(formatApiError(err, '恢复失败'));
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
        <div className="space-y-2">
          <h2 className="font-medium text-sm text-ink">导出账本</h2>
          <p className="text-xs text-muted">
            导出 CSV 含流水与月度余额；日常支出行可查阅，再次导入时由系统根据余额重算。
            手机或飞牛 App 内导出时，请通过系统分享面板选择「存储到文件」保存到本机。
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting}
            onClick={() => void onExport()}
          >
            {exporting ? '导出中…' : '导出 CSV'}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">导入账本（CSV）</h2>
          <p className="text-xs text-muted">
            覆盖导入：将清空现有流水与月度余额后写入文件内容。标签与联系人不存在时会自动创建。
          </p>
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
            {importing ? '导入中…' : '选择 CSV 文件'}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">从备份恢复</h2>
          <p className="text-xs text-muted">
            从 NAS 备份目录选择 zip 备份包覆盖恢复账本（与 CSV 导入相同，不可撤销）。
          </p>
          <button
            type="button"
            className="btn-segment px-4"
            disabled={restoreDisabled}
            onClick={() => void openRestorePicker()}
          >
            {restoring ? '恢复中…' : '恢复'}
          </button>
        </div>
      </div>

      <BackupPickerDialog
        open={backupPickerOpen}
        loading={backupLoading}
        backupPage={backupPage}
        onRefresh={() => void loadBackupFiles()}
        onSelect={onSelectBackup}
        onClose={() => setBackupPickerOpen(false)}
      />

      <ConfirmDialog
        open={pendingFile !== null}
        title="确认覆盖导入"
        message={`将清空现有流水与月度余额，并导入「${pendingFile?.name ?? ''}」。此操作不可撤销。`}
        confirmLabel="确认导入"
        confirming={importing}
        onConfirm={() => void onConfirmImport()}
        onClose={() => {
          if (!importing) setPendingFile(null);
        }}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        title="确认从备份恢复"
        message={`将清空现有流水与月度余额，并从备份「${pendingRestore?.filename ?? ''}」恢复。此操作不可撤销。`}
        confirmLabel="确认恢复"
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
