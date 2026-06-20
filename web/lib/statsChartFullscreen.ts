type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait' | 'any') => Promise<void>;
  unlock?: () => void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

export function isCoarseMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse) and (max-width: 1024px)').matches;
}

export function isFullscreenCssRotated(el: HTMLElement): boolean {
  const panel = el.closest('.stats-chart-fullscreen-landscape');
  if (!panel) return false;
  return getComputedStyle(panel).transform !== 'none';
}

export function shouldUsePortraitFallback(): boolean {
  if (!isCoarseMobile()) return false;
  return window.matchMedia('(orientation: portrait)').matches;
}

/** Must be called directly from a user gesture (click/tap). */
export async function enterChartFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  const root = document.documentElement as FullscreenElement;

  try {
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be unsupported (e.g. older iOS) — overlay still works.
  }

  try {
    const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // Lock requires fullscreen on many browsers; portrait CSS fallback handles the rest.
  }
}

export function unlockLandscape(): void {
  try {
    const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
    orientation?.unlock?.();
  } catch {
    // Ignore unlock failures.
  }
}

export async function exitChartFullscreen(): Promise<void> {
  unlockLandscape();

  const doc = document as FullscreenDocument;
  try {
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    }
  } catch {
    // Ignore exit failures.
  }
}
