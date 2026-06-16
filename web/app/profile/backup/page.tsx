'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import {
  fetchBackup,
  runBackupNow,
  updateBackup,
  type BackupConfig,
  type BackupInterval,
} from '@/lib/api';
import { formatApiError } from '@/lib/errors';

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatLastRun(iso?: string): string {
  if (!iso) return '尚未备份';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function BackupContent() {
  const [cfg, setCfg] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBackup();
      setCfg(data);
    } catch (err) {
      setError(formatApiError(err, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    setMsg('');
    setError('');
    try {
      const saved = await updateBackup({
        enabled: cfg.enabled,
        interval: cfg.interval,
        hour: cfg.hour,
        weekday: cfg.weekday,
        month_day: cfg.month_day,
        keep_count: cfg.keep_count,
      });
      setCfg(saved);
      setMsg('已保存');
    } catch (err) {
      setError(formatApiError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const onRunNow = async () => {
    setRunning(true);
    setMsg('');
    setError('');
    try {
      const result = await runBackupNow();
      setMsg(`备份完成：${result.filename}`);
      await load();
    } catch (err) {
      setError(formatApiError(err, '备份失败'));
    } finally {
      setRunning(false);
    }
  };

  if (loading || !cfg) {
    return (
      <div className="space-y-6">
        <BackLink href="/profile/">我的</BackLink>
        <p className="text-sm text-muted">{loading ? '加载中…' : error || '无法加载'}</p>
      </div>
    );
  }

  const dirReady = cfg.dir_configured;
  const scheduleDisabled = saving || running;
  const runDisabled = !dirReady || running || saving;

  return (
    <div className="space-y-6">
      <BackLink href="/profile/">我的</BackLink>

      {msg && <p className="text-income text-sm">{msg}</p>}
      {error && <p className="text-expense text-sm">{error}</p>}

      <div className="notebook p-4 space-y-4">
        <div className="space-y-2">
          <h2 className="font-medium text-sm text-ink">备份目录</h2>
          {dirReady ? (
            <p className="text-xs text-muted break-all">
              已配置：{cfg.dir_path}
            </p>
          ) : (
            <p className="text-xs text-muted">
              备份目录未配置，可先保存下方定时设置；实际备份需在飞牛 OS 应用中心 → 轻账单 → 应用设置 → 运行设置中填写备份路径，或本地 / Docker 设置环境变量
              BACKUP_DIR。
            </p>
          )}
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-ink">定期备份</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.enabled}
                disabled={scheduleDisabled}
                onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
              />
              <span className="text-ink">启用</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted">周期</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['daily', '每日'],
                  ['weekly', '每周'],
                  ['monthly', '每月'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={scheduleDisabled}
                  className={cfg.interval === value ? 'btn-segment-active px-4' : 'btn-segment px-4'}
                  onClick={() => setCfg({ ...cfg, interval: value as BackupInterval })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted">执行时间（时）</label>
              <select
                className="field w-full"
                disabled={scheduleDisabled}
                value={cfg.hour}
                onChange={(e) => setCfg({ ...cfg, hour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">保留份数</label>
              <input
                type="number"
                min={1}
                max={365}
                className="field w-full"
                disabled={scheduleDisabled}
                value={cfg.keep_count}
                onChange={(e) =>
                  setCfg({ ...cfg, keep_count: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>

          {cfg.interval === 'weekly' && (
            <div className="space-y-1">
              <label className="text-xs text-muted">星期</label>
              <select
                className="field w-full"
                disabled={scheduleDisabled}
                value={cfg.weekday}
                onChange={(e) => setCfg({ ...cfg, weekday: Number(e.target.value) })}
              >
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cfg.interval === 'monthly' && (
            <div className="space-y-1">
              <label className="text-xs text-muted">每月几号（1–28）</label>
              <select
                className="field w-full"
                disabled={scheduleDisabled}
                value={cfg.month_day}
                onChange={(e) => setCfg({ ...cfg, month_day: Number(e.target.value) })}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} 日
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-muted">
            备份文件格式：{'{用户名}_轻账单_备份_{yyyyMMddHHmmss}.zip'}，内含同名 CSV。
          </p>

          <button
            type="button"
            className="btn-primary"
            disabled={scheduleDisabled}
            onClick={() => void onSave()}
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">立即备份</h2>
          <p className="text-xs text-muted">导出当前账本 CSV 并压缩为 zip 写入备份目录。</p>
          <button
            type="button"
            className="btn-segment px-4"
            disabled={runDisabled}
            onClick={() => void onRunNow()}
          >
            {running ? '备份中…' : '立即备份'}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-1 text-xs text-muted">
          <p>最近备份：{formatLastRun(cfg.last_run_at)}</p>
          {cfg.last_file && <p>文件：{cfg.last_file}</p>}
          {cfg.last_status === 'error' && cfg.last_error && (
            <p className="text-expense">错误：{cfg.last_error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BackupPage() {
  return (
    <RequireAuth>
      <BackupContent />
    </RequireAuth>
  );
}
