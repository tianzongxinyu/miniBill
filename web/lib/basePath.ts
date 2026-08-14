/** App base path for fnOS gateway builds (e.g. /app/minibill). Empty for Docker/local. */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/** Pathname relative to basePath (always starts with /). */
export function appPathname(pathname?: string): string {
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (BASE_PATH && (p === BASE_PATH || p.startsWith(`${BASE_PATH}/`))) {
    const rest = p.slice(BASE_PATH.length);
    return rest || '/';
  }
  return p || '/';
}
