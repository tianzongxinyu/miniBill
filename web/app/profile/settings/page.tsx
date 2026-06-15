'use client';

import { useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSettings } from '@/components/SettingsProvider';
import { api, type AmountColorScheme } from '@/lib/api';
import { formatApiError } from '@/lib/errors';

function SettingsContent() {
  const { settings, updateSettings } = useSettings();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [savingScheme, setSavingScheme] = useState(false);

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      setMsg('密码已修改');
      setOldPwd('');
      setNewPwd('');
    } catch (err) {
      setMsg(formatApiError(err, '失败'));
    }
  };

  const changeColorScheme = async (scheme: AmountColorScheme) => {
    if (scheme === settings.amount_color_scheme || savingScheme) return;
    setSavingScheme(true);
    setMsg('');
    try {
      await updateSettings({ ...settings, amount_color_scheme: scheme });
      setMsg('配色已更新');
    } catch (err) {
      setMsg(formatApiError(err, '保存失败'));
    } finally {
      setSavingScheme(false);
    }
  };

  return (
    <div className="space-y-6">
      <BackLink href="/profile/">我的</BackLink>
      <PageHeader title="设置" />
      {msg && <p className="text-income text-sm">{msg}</p>}

      <div className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">金额配色</h2>
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
            收入红 / 支出绿
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
            收入绿 / 支出红
          </button>
        </div>
      </div>

      <form onSubmit={changePwd} className="notebook p-4 space-y-3">
        <h2 className="font-medium text-sm text-ink">修改密码</h2>
        <input type="password" placeholder="原密码" className="field" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
        <input type="password" placeholder="新密码" className="field" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
        <button className="btn-primary">修改</button>
      </form>
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
