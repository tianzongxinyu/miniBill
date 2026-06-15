'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { formatApiError } from '@/lib/errors';
import { AppLogo } from '@/components/ui/AppLogo';

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    try {
      await register(username, password);
      window.location.href = '/';
    } catch (err) {
      setError(formatApiError(err, '注册失败'));
    }
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex lg:w-[42%] bg-gradient-to-br from-accent to-accent-muted flex-col justify-between p-10 text-white">
        <div className="animate-fade-in-up">
          <AppLogo size="lg" className="mb-8" priority />
          <h1 className="text-3xl font-semibold tracking-tight">开始使用</h1>
          <p className="text-white/80 mt-3 text-base leading-relaxed max-w-xs">
            创建账号，开启你的私人账本。所有数据存储在你自己的服务器上。
          </p>
        </div>
        <p className="text-xs text-white/50">用户名 3～32 位 · 密码至少 6 位</p>
      </aside>

      <div className="flex-1 flex items-center justify-center p-6 bg-canvas">
        <form onSubmit={submit} className="w-full max-w-sm animate-scale-in space-y-5">
          <div className="hidden lg:block mb-2">
            <h2 className="text-xl font-semibold text-ink">注册账号</h2>
            <p className="text-sm text-muted mt-1">填写以下信息</p>
          </div>
          {error && <p className="text-expense text-sm animate-fade-in">{error}</p>}
          <input
            className="field"
            placeholder="用户名 3～32 位"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="field"
            placeholder="密码至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            className="field"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button type="submit" className="btn-primary-block">
            注册
          </button>
          <p className="text-center text-sm text-muted">
            已有账号？<Link href="/login/" className="text-ink underline underline-offset-4 hover:opacity-70 transition-opacity">登录</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
