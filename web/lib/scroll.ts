export function getScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function isNearPageBottom(threshold = 32) {
  const scrollY = getScrollY();
  const viewport = window.innerHeight;
  const scrollHeight = document.documentElement.scrollHeight;
  return scrollY + viewport >= scrollHeight - threshold;
}

export function scrollToTop(smooth = true) {
  window.scrollTo({ top: 0, left: 0, behavior: smooth ? 'smooth' : 'auto' });
}

const TX_SCROLL_RESTORE = 'minibill:tx-scroll';

/** 进入编辑页前保存当前列表 URL 与滚动位置，返回后恢复。 */
export function stashTransactionsScroll(returnTo: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    TX_SCROLL_RESTORE,
    JSON.stringify({ returnTo, scrollY: getScrollY() })
  );
}

export function pullTransactionsScroll(returnTo: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(TX_SCROLL_RESTORE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { returnTo?: string; scrollY?: number };
    if (parsed.returnTo === returnTo && typeof parsed.scrollY === 'number') {
      sessionStorage.removeItem(TX_SCROLL_RESTORE);
      return parsed.scrollY;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function scrollToY(y: number) {
  window.scrollTo({ top: y, left: 0, behavior: 'auto' });
}

export function currentPathWithSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}
