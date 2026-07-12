import type { User } from '@/lib/api/types';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';
export const REMEMBER_KEY = 'remember_login';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

function authStore(persistent: boolean): Storage {
  return persistent ? localStorage : sessionStorage;
}

export function getRememberLogin(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(REMEMBER_KEY);
  return v === null || v === '1';
}

export function setRememberLogin(remember: boolean) {
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

/** 从 localStorage / sessionStorage 读取 JWT；Cookie 由浏览器自动携带 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  const raw =
    localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

async function revokeAuthCookie(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    /* ignore network errors during logout */
  }
}

export function notifyAuthSession() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('auth:session'));
}

export function notifyAuthLogout() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('auth:logout'));
}

/** 整页跳转；优先 replace，WebView 下更可靠 */
export function hardNavigate(path: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(path, window.location.origin).href;
  try {
    window.location.replace(url);
  } catch {
    window.location.href = url;
  }
}

export function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path.startsWith('/login') || path.startsWith('/register')) return;
  hardNavigate('/login/');
}

export function redirectToHome() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path === '/' || path === '') return;
  hardNavigate('/');
}

/** 清除登录态；不在登录页时整页跳转，避免先 notify 导致 RequireAuth 白屏 */
export async function clearAuthAndGoLogin() {
  await revokeAuthCookie();
  clearAuthStorage();
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path.startsWith('/login') || path.startsWith('/register')) {
    notifyAuthLogout();
    return;
  }
  hardNavigate('/login/');
}

export function setAuthSession(token: string, user: User, remember: boolean) {
  clearAuthStorage();
  setRememberLogin(remember);
  const store = authStore(remember);
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthSession();
}

/** 清除登录态并跳转登录页（整页刷新，避免 SPA 状态卡住） */
export async function logoutAndRedirect() {
  await clearAuthAndGoLogin();
}
