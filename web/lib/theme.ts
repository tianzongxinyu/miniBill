export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'minibill-theme';
export const DEFAULT_THEME: ThemePreference = 'light';

/** Host (fnOS) theme used when preference is `system`; null = use prefers-color-scheme. */
let hostSystemTheme: ResolvedTheme | null = null;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Set/clear fnOS host theme override for `system` preference. */
export function setHostSystemTheme(theme: ResolvedTheme | null) {
  hostSystemTheme = theme;
}

export function getHostSystemTheme(): ResolvedTheme | null {
  return hostSystemTheme;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref;
  if (typeof window === 'undefined') return 'light';
  if (hostSystemTheme) return hostSystemTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeColorMeta() {
  if (typeof document === 'undefined') return;
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-color')
    .trim();
  if (!color) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

let systemMedia: MediaQueryList | null = null;
let systemHandler: (() => void) | null = null;

function clearSystemWatch() {
  if (systemMedia && systemHandler) {
    systemMedia.removeEventListener('change', systemHandler);
  }
  systemMedia = null;
  systemHandler = null;
}

export function watchSystemTheme(pref: ThemePreference) {
  clearSystemWatch();
  if (pref !== 'system' || typeof window === 'undefined') return;
  // When host theme drives system mode, skip OS media query.
  if (hostSystemTheme) return;
  systemMedia = window.matchMedia('(prefers-color-scheme: dark)');
  systemHandler = () => {
    applyTheme('system', { persist: false });
  };
  systemMedia.addEventListener('change', systemHandler);
}

/** Apply preference to <html data-theme>. By default also writes localStorage. */
export function applyTheme(
  pref: ThemePreference,
  options?: { persist?: boolean }
): ResolvedTheme {
  const persist = options?.persist !== false;
  const resolved = resolveTheme(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    syncThemeColorMeta();
  }
  if (persist && typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* ignore quota */
    }
  }
  watchSystemTheme(pref);
  return resolved;
}

/**
 * Apply host theme while preference stays `system`.
 * No-op if current preference is explicit light/dark.
 */
export function applyHostThemeIfSystem(hostTheme: ResolvedTheme) {
  setHostSystemTheme(hostTheme);
  const pref = getStoredTheme() ?? DEFAULT_THEME;
  if (pref === 'system') {
    applyTheme('system', { persist: false });
  }
}

/** Inline bootstrap for layout — keep in sync with resolveTheme / storage key. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k)||${JSON.stringify(DEFAULT_THEME)};if(p!=='light'&&p!=='dark'&&p!=='system')p=${JSON.stringify(DEFAULT_THEME)};var r=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){}})();`;
