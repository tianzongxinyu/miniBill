'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequireAuth } from '@/components/RequireAuth';
import { PageBackLink } from '@/components/ui/BackLink';
import { LocaleSelect } from '@/components/ui/LocaleSelect';
import { useSettings } from '@/components/SettingsProvider';
import { api, type AmountColorScheme } from '@/lib/api';
import { formatApiError } from '@/lib/errors';
import type { Locale } from '@/lib/i18n/utils';

function SettingsContent() {
  const { t } = useTranslation();
  const { settings, updateSettings, setLocale } = useSettings();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [savingScheme, setSavingScheme] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      setMsg(t('settings.passwordChanged'));
      setOldPwd('');
      setNewPwd('');
    } catch (err) {
      setMsg(formatApiError(err, t('settings.failed')));
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
        <input type="password" placeholder={t('settings.oldPassword')} className="field" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
        <input type="password" placeholder={t('settings.newPassword')} className="field" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
        <button className="btn-primary">{t('settings.change')}</button>
      </form>
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
