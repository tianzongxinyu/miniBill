'use client';

import { useRef, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { exportLedgerCSV, importLedgerCSV, type LedgerImportResult } from '@/lib/api';
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

function DataContent() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const onExport = async () => {
    setError('');
    setMsg('');
    setExporting(true);
    try {
      await exportLedgerCSV();
      setMsg('导出已开始下载');
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

  return (
    <div className="space-y-6">
      <BackLink href="/profile/">我的</BackLink>
      <PageHeader title="数据管理" />

      {msg && <p className="text-income text-sm">{msg}</p>}
      {error && <p className="text-expense text-sm">{error}</p>}

      <div className="notebook p-4 space-y-4">
        <div className="space-y-2">
          <h2 className="font-medium text-sm text-ink">导出账本</h2>
          <p className="text-xs text-muted">
            导出 CSV 含流水与月度余额；日常支出行可查阅，再次导入时由系统根据余额重算。
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
          <h2 className="font-medium text-sm text-ink">导入账本</h2>
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
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? '导入中…' : '选择 CSV 文件'}
          </button>
        </div>
      </div>

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
