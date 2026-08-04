'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { useLedgerAccess } from '@/components/LedgerAccessProvider';
import { PageBackLink } from '@/components/ui/BackLink';
import { LocaleSelect } from '@/components/ui/LocaleSelect';
import { useSettings } from '@/components/SettingsProvider';
import { api, logoutAndRedirect, type AmountColorScheme } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import { openFnosAppSetting, useFnosReady } from '@/lib/fnos/hooks';
import type { Locale } from '@/lib/i18n/utils';
import type { ThemePreference } from '@/lib/theme';

function SettingsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isOwner, ready: ledgerReady } = useLedgerAccess();
  const { settings, updateSettings, setLocale, setTheme } = useSettings();
  const fnosReady = useFnosReady();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [savingScheme, setSavingScheme] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (!ledgerReady) return;
    if (!isOwner) {
      router.replace('/profile/');
    }
  }, [isOwner, ledgerReady, router]);

  if (!isOwner) {
    return null;
  }

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPwd(true);
    setMsg('');
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      await logoutAndRedirect();
    } catch (err) {
      setMsg(formatApiError(err, t('settings.failed')));
      setChangingPwd(false);
    }
  };

  const changeColorScheme = async (scheme: AmountColorScheme) => {
    if (scheme === settings.amount_color_scheme || savingScheme) return;
    setSavingScheme(true);
    setMsg('');
    try {
      await updateSettings({ ...settings, amount_color_scheme: scheme });
      setMsg(t('settings.colorSchemeUpdated'));
    } catch (err) {
      setMsg(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSavingScheme(false);
    }
  };

  const changeLocale = async (locale: Locale) => {
    if (locale === settings.locale || savingLocale) return;
    setSavingLocale(true);
    setMsg('');
    setLocale(locale);
    try {
      await updateSettings({ ...settings, locale });
    } catch (err) {
      setMsg(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSavingLocale(false);
    }
  };

  const changeTheme = async (theme: ThemePreference) => {
    if (theme === settings.theme || savingTheme) return;
    setSavingTheme(true);
    setMsg('');
    setTheme(theme);
    try {
      await updateSettings({ ...settings, theme });
      setMsg(t('settings.themeUpdated'));
    } catch (err) {
      setMsg(formatApiError(err, t('common.saveFailed')));
    } finally {
      setSavingTheme(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'system', label: t('settings.themeSystem') },
  ];

  return (
    <div className="space-y-3">
      {msg && <p className="text-income text-sm">{msg}</p>}

      <div className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">{t('settings.language')}</h2>
        <LocaleSelect
          variant="full"
          value={settings.locale as Locale}
          onChange={(locale) => void changeLocale(locale)}
          disabled={savingLocale}
          searchable
        />
      </div>

      <div className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">{t('settings.theme')}</h2>
        <div className="flex flex-wrap gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={savingTheme}
              onClick={() => void changeTheme(opt.value)}
              className={
                settings.theme === opt.value ? 'btn-segment-active px-4' : 'btn-segment px-4'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">{t('settings.amountColorScheme')}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={savingScheme}
            onClick={() => changeColorScheme('red_up')}
            className={
              settings.amount_color_scheme === 'red_up'
                ? 'btn-segment-active px-4'
                : 'btn-segment px-4'
            }
          >
            {t('settings.redUpGreenDown')}
          </button>
          <button
            type="button"
            disabled={savingScheme}
            onClick={() => changeColorScheme('green_up')}
            className={
              settings.amount_color_scheme === 'green_up'
                ? 'btn-segment-active px-4'
                : 'btn-segment px-4'
            }
          >
            {t('settings.greenUpRedDown')}
          </button>
        </div>
      </div>

      <form onSubmit={changePwd} className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">{t('settings.changePassword')}</h2>
        <input type="password" placeholder={t('settings.oldPassword')} className="field" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} disabled={changingPwd} />
        <input type="password" placeholder={t('settings.newPassword')} className="field" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} disabled={changingPwd} />
        <button className="btn-primary" disabled={changingPwd}>{t('settings.change')}</button>
      </form>
      {fnosReady && (
        <div className="notebook p-4 space-y-3">
          <button
            type="button"
            className="btn-segment px-4"
            onClick={() => void openFnosAppSetting()}
          >
            {t('settings.openFnosAppSetting')}
          </button>
        </div>
      )}
      <PageBackLink href="/profile/" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
