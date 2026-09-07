import { getActiveLocale, getStoredLocale } from '@/lib/i18n/utils';
import { toIntlLocale } from '@/lib/i18n/intlLocale';
import i18n from '@/src/i18n';
import { clearAuthAndGoLogin, getToken } from '@/lib/api/auth';
import { getStoredLedgerOwnerId, setStoredLedgerOwnerId } from '@/lib/api/access';
import { BASE_PATH } from '@/lib/basePath';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register'];
const SKIP_LEDGER_HEADER_PATHS = [
  '/auth/',
  '/admin/',
  '/ledgers',
  '/users/directory',
  '/ledger/grants',
];

/** fpk 网关构建：不发 Bearer，避免统一网关把 MiniBill JWT 当成 trim token 拒掉 */
const COOKIE_AUTH_ONLY = Boolean(BASE_PATH);

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export type ApiOptions = RequestInit & {
  /** 401 时是否清除登录并跳转登录页，默认 true */
  authRedirect?: boolean;
};

function isAuthFormRequest(path: string, method?: string) {
  return method?.toUpperCase() === 'POST' && AUTH_FORM_PATHS.some((p) => path.startsWith(p));
}

function shouldAttachLedgerHeader(path: string) {
  return !SKIP_LEDGER_HEADER_PATHS.some((p) => path.startsWith(p));
}

let logoutRedirectInflight = false;

export function logoutOnUnauthorized() {
  if (logoutRedirectInflight) return;
  logoutRedirectInflight = true;
  void clearAuthAndGoLogin().finally(() => {
    if (typeof window === 'undefined') {
      logoutRedirectInflight = false;
      return;
    }
    window.setTimeout(() => {
      logoutRedirectInflight = false;
    }, 800);
  });
}

function resetLedgerAccessOnForbidden() {
  if (getStoredLedgerOwnerId() == null) return;
  setStoredLedgerOwnerId(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ledger:access-reset'));
  }
}

function buildApiHeaders(extra?: Record<string, string>, skipContentType?: boolean, path?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!skipContentType) headers['Content-Type'] = 'application/json';
  const locale = getStoredLocale() ?? getActiveLocale();
  headers['Accept-Language'] = toIntlLocale(locale);
  if (extra) Object.assign(headers, extra);
  if (!COOKIE_AUTH_ONLY) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (path && shouldAttachLedgerHeader(path)) {
    const ownerId = getStoredLedgerOwnerId();
    if (ownerId != null) {
      headers['X-Ledger-Owner-Id'] = String(ownerId);
    }
  }
  return headers;
}

/** fnOS 统一网关在 NAS 会话无效时可能返回纯文本，而非 JSON */
function isGatewayInvalidToken(body: string): boolean {
  return body.trim().toLowerCase() === 'invalid token';
}

function throwUnauthorized(authRedirect: boolean): never {
  if (authRedirect) logoutOnUnauthorized();
  throw new ApiError('UNAUTHORIZED', i18n.t('error.unauthorized'), 401);
}

/** 安全解析 JSON 正文；识别网关 `invalid token`；非 JSON 抛稳定 ApiError */
export async function parseApiJson<T>(res: Response, authRedirect = true): Promise<T> {
  const text = (await res.text()).trim();
  if (isGatewayInvalidToken(text)) {
    throwUnauthorized(authRedirect);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('NETWORK_ERROR', i18n.t('error.networkError'), res.status || 0);
  }
}

async function parseApiErrorResponse(res: Response, path: string, authRedirect: boolean): Promise<never> {
  const text = (await res.text()).trim();
  if (isGatewayInvalidToken(text)) {
    throwUnauthorized(authRedirect);
  }
  let data: { error?: string; message?: string } = {};
  try {
    data = text ? (JSON.parse(text) as { error?: string; message?: string }) : {};
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 403 && getStoredLedgerOwnerId() != null && shouldAttachLedgerHeader(path)) {
    resetLedgerAccessOnForbidden();
  }
  if (res.status >= 500 && !data.error) {
    throw new ApiError('NETWORK_ERROR', i18n.t('error.networkErrorConfirm'), res.status);
  }
  throw new ApiError(data.error || 'ERROR', data.message || res.statusText, res.status);
}

export async function apiRaw(path: string, options: ApiOptions = {}): Promise<Response> {
  const { authRedirect = true, ...fetchOptions } = options;
  const skipContentType = fetchOptions.body instanceof FormData;
  const headers = buildApiHeaders(fetchOptions.headers as Record<string, string>, skipContentType, path);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'same-origin',
    });
  } catch {
    if (fetchOptions.signal?.aborted) {
      throw new ApiError('ABORTED', i18n.t('error.aborted'), 0);
    }
    throw new ApiError('NETWORK_ERROR', i18n.t('error.networkError'), 0);
  }

  const skipAuthRedirect = isAuthFormRequest(path, fetchOptions.method);
  const effectiveRedirect = authRedirect && !skipAuthRedirect;

  // 网关可能以任意状态码返回纯文本 invalid token（含 2xx）
  const peek = (await res.clone().text()).trim();
  if (isGatewayInvalidToken(peek)) {
    throwUnauthorized(effectiveRedirect);
  }

  if (res.status === 401 && !skipAuthRedirect) {
    throwUnauthorized(authRedirect);
  }
  if (!res.ok) {
    await parseApiErrorResponse(res, path, effectiveRedirect);
  }
  return res;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { authRedirect = true } = options;
  const res = await apiRaw(path, options);
  if (res.status === 204) return undefined as T;
  return parseApiJson<T>(res, authRedirect);
}

/** 列表接口：保证 items 为数组；失败时抛出 ApiError */
export async function apiList<T>(path: string, options?: RequestInit): Promise<T[]> {
  const data = await api<{ items?: T[] | null }>(path, options);
  return Array.isArray(data?.items) ? data.items : [];
}
