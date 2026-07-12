import { getActiveLocale, getStoredLocale } from '@/lib/i18n/utils';
import { toIntlLocale } from '@/lib/i18n/intlLocale';
import i18n from '@/src/i18n';
import { clearAuthAndGoLogin, getToken } from '@/lib/api/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
const AUTH_FORM_PATHS = ['/auth/login', '/auth/register'];

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

export function logoutOnUnauthorized() {
  void clearAuthAndGoLogin();
}

function buildApiHeaders(extra?: Record<string, string>, skipContentType?: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!skipContentType) headers['Content-Type'] = 'application/json';
  const locale = getStoredLocale() ?? getActiveLocale();
  headers['Accept-Language'] = toIntlLocale(locale);
  if (extra) Object.assign(headers, extra);
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseApiErrorResponse(res: Response): Promise<never> {
  if (res.status >= 500) {
    const data = await res.json().catch(() => ({}));
    if (!data.error) {
      throw new ApiError('NETWORK_ERROR', i18n.t('error.networkErrorConfirm'), res.status);
    }
  }
  const data = await res.json().catch(() => ({}));
  throw new ApiError(data.error || 'ERROR', data.message || res.statusText, res.status);
}

export async function apiRaw(path: string, options: ApiOptions = {}): Promise<Response> {
  const { authRedirect = true, ...fetchOptions } = options;
  const skipContentType = fetchOptions.body instanceof FormData;
  const headers = buildApiHeaders(fetchOptions.headers as Record<string, string>, skipContentType);

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
  if (res.status === 401 && !isAuthFormRequest(path, fetchOptions.method)) {
    if (authRedirect) logoutOnUnauthorized();
    throw new ApiError('UNAUTHORIZED', i18n.t('error.unauthorized'), 401);
  }
  if (!res.ok) {
    await parseApiErrorResponse(res);
  }
  return res;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await apiRaw(path, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 列表接口：保证 items 为数组；失败时抛出 ApiError */
export async function apiList<T>(path: string, options?: RequestInit): Promise<T[]> {
  const data = await api<{ items?: T[] | null }>(path, options);
  return Array.isArray(data?.items) ? data.items : [];
}
