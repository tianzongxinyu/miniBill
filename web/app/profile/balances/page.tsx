'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/RequireAuth';
import { BackLink } from '@/components/ui/BackLink';
import { PageHeader } from '@/components/ui/PageHeader';
import { Notebook } from '@/components/ui/Notebook';
import { api, apiList, ApiError, Balance, yuanToCents, centsToYuan } from '@/lib/api';

function BalancesContent() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<Balance[]>([]);
  const [error, setError] = useState('');

  const load = () => apiList<Balance>('/monthly-balances').then(setItems);

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api(`/monthly-balances/${year}/${month}`, {
        method: 'PUT',
        body: JSON.stringify({ balance: yuanToCents(balance), note }),
      });
      load();
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败');
    }
  };

  return (
    <div>
      <BackLink href="/profile/">我的</BackLink>
      <PageHeader title="月度余额登记" />
      {error && <p className="text-expense text-sm mb-4">{error}</p>}
      <form onSubmit={save} className="notebook p-4 space-y-3 mb-4">
        <div className="flex gap-2">
          <input type="number" className="field-sm w-24" value={year} onChange={(e) => setYear(+e.target.value)} />
          <input type="number" min={1} max={12} className="field-sm w-16" value={month} onChange={(e) => setMonth(+e.target.value)} />
        </div>
        <input type="number" step="0.01" placeholder="余额（元）" className="field-amount" value={balance} onChange={(e) => setBalance(e.target.value)} required />
        <input placeholder="备注" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary-block">保存</button>
      </form>
      <Notebook>
        {items.map((b) => (
          <div key={`${b.year}-${b.month}`} className="notebook-row flex justify-between items-center text-sm">
            <span className="text-ink">{b.year} 年 {b.month} 月</span>
            <span className="tabular-nums text-ink">
              <span className="amount-num">¥{centsToYuan(b.balance)}</span>
            </span>
          </div>
        ))}
      </Notebook>
    </div>
  );
}

export default function BalancesPage() {
  return <RequireAuth><BalancesContent /></RequireAuth>;
}
