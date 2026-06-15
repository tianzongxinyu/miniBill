'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { formatApiError } from '@/lib/errors';
import { AppLogo } from '@/components/ui/AppLogo';
import { APP_NAME } from '@/lib/appMeta';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      window.location.href = '/';
    } catch (err) {
      setError(formatApiError(err, '登录失败'));
    }
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-accent to-accent-muted flex-col justify-between p-10 text-white">
        <div className="animate-fade-in-up">
          <AppLogo size="lg" className="mb-8" priority />
          <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="text-white/80 mt-3 text-base leading-relaxed max-w-xs">
            轻量、自托管的个人记账本。简洁清晰，数据留在你自己手里。
          </p>
        </div>
        <p className="text-xs text-white/50 animate-fade-in" style={{ animationDelay: '200ms' }}>
          自托管 · 多用户 · 开源
        </p>
      </aside>

      <div className="flex-1 flex items-center justify-center p-6 bg-canvas">
        <form onSubmit={submit} className="w-full max-w-sm animate-scale-in space-y-5">
          <div className="lg:hidden text-center mb-6">
            <AppLogo size="md" className="mb-3 mx-auto" priority />
            <h1 className="text-2xl font-semibold text-ink">{APP_NAME}</h1>
          </div>
          <div className="hidden lg:block mb-2">
            <h2 className="text-xl font-semibold text-ink">欢迎回来</h2>
            <p className="text-sm text-muted mt-1">登录以继续</p>
          </div>
          {error && <p className="text-expense text-sm animate-fade-in">{error}</p>}
          <input
            className="field"
            placeholder="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="field"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary-block">
            登录
          </button>
          <p className="text-center text-sm text-muted">
            没有账号？<Link href="/register/" className="text-ink underline underline-offset-4 hover:opacity-70 transition-opacity">注册</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
