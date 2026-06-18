'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { useSettings } from '@/components/SettingsProvider';
import {
  fetchBackup,
  runBackupNow,
  updateBackup,
  type BackupConfig,
  type BackupInterval,
} from '@/lib/api';
import { toIntlLocale } from '@/lib/i18n/intlLocale';
import { formatApiError } from '@/lib/errors';
import { OptionPickerField } from '@/components/ui/OptionPickerField';

const BACKUP_MINUTES = [0, 10, 20, 30, 40, 50] as const;
const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, '0'),
}));
const MINUTE_ITEMS = BACKUP_MINUTES.map((m) => ({
  value: m,
  label: String(m).padStart(2, '0'),
}));
const MONTH_DAY_ITEMS = Array.from({ length: 28 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

const WEEKDAY_KEYS = [
  'backup.weekdaySun',
  'backup.weekdayMon',
  'backup.weekdayTue',
  'backup.weekdayWed',
  'backup.weekdayThu',
  'backup.weekdayFri',
  'backup.weekdaySat',
] as const;

function BackupContent() {
  const { t } = useTranslation();
  const { locale } = useSettings();
  const [cfg, setCfg] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const weekdayItems = useMemo(
    () => WEEKDAY_KEYS.map((key, i) => ({ value: i, label: t(key) })),
    [t]
  );

  const formatLastRun = useCallback(
    (iso?: string): string => {
      if (!iso) return t('backup.neverBackedUp');
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return t('backup.lastBackup', {
        time: d.toLocaleString(toIntlLocale(locale), { hour12: false }),
      });
    },
    [t, locale]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBackup();
      setCfg(data);
    } catch (err) {
      setError(formatApiError(err, t('backup.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        minute: cfg.minute ?? 0,
        weekday: cfg.weekday,
        month_day: cfg.month_day,
        keep_count: cfg.keep_count,
      });
      setCfg(saved);
      setMsg(t('backup.saved'));
    } catch (err) {
      setError(formatApiError(err, t('backup.saveFailed')));
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
      setMsg(t('backup.backupComplete', { filename: result.filename }));
      await load();
    } catch (err) {
      setError(formatApiError(err, t('backup.backupFailed')));
    } finally {
      setRunning(false);
    }
  };

  if (loading || !cfg) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted">{loading ? t('common.loading') : error || t('common.cannotLoad')}</p>
        <PageBackLink href="/profile/" />
      </div>
    );
  }

  const dirReady = cfg.dir_configured;
  const scheduleDisabled = saving || running;
  const runDisabled = !dirReady || running || saving;

  return (
    <div className="space-y-6">
      {msg && <p className="text-income text-sm">{msg}</p>}
      {error && <p className="text-expense text-sm">{error}</p>}

      <div className="notebook p-4 space-y-4">
        <div className="space-y-2">
          <h2 className="font-medium text-sm text-ink">{t('backup.backupDir')}</h2>
          {dirReady ? (
            <p className="text-xs text-muted break-all">
              {t('backup.configured', { path: cfg.dir_path })}
            </p>
          ) : (
            <p className="text-xs text-muted">{t('backup.dirNotConfigured')}</p>
          )}
        </div>

        <div className="border-t border-line pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-ink">{t('backup.scheduledBackup')}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.enabled}
                disabled={scheduleDisabled}
                onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
              />
              <span className="text-ink">{t('backup.enable')}</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted">{t('backup.interval')}</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['daily', t('backup.daily')],
                  ['weekly', t('backup.weekly')],
                  ['monthly', t('backup.monthly')],
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

          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0 space-y-1">
              <label className="text-xs text-muted">{t('backup.hour')}</label>
              <OptionPickerField
                value={cfg.hour}
                onChange={(hour) => setCfg({ ...cfg, hour })}
                items={HOUR_ITEMS}
                disabled={scheduleDisabled}
                ariaLabel={t('backup.selectHour')}
                panelTitle={t('backup.hourPanel')}
                gridClassName="time-unit-picker-grid-hours"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-xs text-muted">{t('backup.minute')}</label>
              <OptionPickerField
                value={cfg.minute ?? 0}
                onChange={(minute) => setCfg({ ...cfg, minute })}
                items={MINUTE_ITEMS}
                disabled={scheduleDisabled}
                ariaLabel={t('backup.selectMinute')}
                panelTitle={t('backup.minutePanel')}
                gridClassName="time-unit-picker-grid"
              />
            </div>
            <div className="backup-keep-count-field min-w-0 space-y-1">
              <label className="text-xs text-muted">{t('backup.keepCount')}</label>
              <input
                type="number"
                min={1}
                max={365}
                className="field w-full tabular-nums text-center"
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
              <label className="text-xs text-muted">{t('backup.weekday')}</label>
              <OptionPickerField
                value={cfg.weekday}
                onChange={(weekday) => setCfg({ ...cfg, weekday })}
                items={weekdayItems}
                disabled={scheduleDisabled}
                ariaLabel={t('backup.selectWeekday')}
                panelTitle={t('backup.weekdayPanel')}
                gridClassName="time-unit-picker-grid-weekdays"
              />
            </div>
          )}

          {cfg.interval === 'monthly' && (
            <div className="space-y-1">
              <label className="text-xs text-muted">{t('backup.monthDay')}</label>
              <OptionPickerField
                value={cfg.month_day}
                onChange={(month_day) => setCfg({ ...cfg, month_day })}
                items={MONTH_DAY_ITEMS}
                disabled={scheduleDisabled}
                ariaLabel={t('backup.selectMonthDay')}
                panelTitle={t('backup.monthDayPanel')}
                gridClassName="time-unit-picker-grid-month-days"
              />
            </div>
          )}

          <p className="text-xs text-muted">{t('backup.fileFormat')}</p>

          <button
            type="button"
            className="btn-primary"
            disabled={scheduleDisabled}
            onClick={() => void onSave()}
          >
            {saving ? t('backup.saving') : t('backup.saveSettings')}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-2">
          <h2 className="font-medium text-sm text-ink">{t('backup.runNow')}</h2>
          <p className="text-xs text-muted">{t('backup.runNowDescription')}</p>
          <button
            type="button"
            className="btn-segment px-4"
            disabled={runDisabled}
            onClick={() => void onRunNow()}
          >
            {running ? t('backup.running') : t('backup.runNow')}
          </button>
        </div>

        <div className="border-t border-line pt-4 space-y-1 text-xs text-muted">
          <p>{formatLastRun(cfg.last_run_at)}</p>
          {cfg.last_file && <p>{t('common.file', { name: cfg.last_file })}</p>}
          {cfg.last_status === 'error' && cfg.last_error && (
            <p className="text-expense">{t('common.errorPrefix', { message: cfg.last_error })}</p>
          )}
        </div>
      </div>
      <PageBackLink href="/profile/" />
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
